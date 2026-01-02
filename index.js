const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const { parse } = require('csv-parse/sync');
const express = require('express');

// --- SERVIDOR KEEP-ALIVE PARA O RENDER ---
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot de Consulta está vivo!'));
app.listen(port, () => console.log(`Servidor HTTP rodando na porta ${port}`));

// --- CONFIGURAÇÕES DAS PLANILHAS ---
const URL_NATAL = 'https://docs.google.com/spreadsheets/d/1ekbmoobOkE5CWkd5L_fIlXm1s_SUNOscy8Qh8TYahhQ/export?format=csv&gid=1613245670';
const URL_FORTALEZA = 'https://docs.google.com/spreadsheets/d/1ekbmoobOkE5CWkd5L_fIlXm1s_SUNOscy8Qh8TYahhQ/export?format=csv&gid=0';
const GRUPOS_AUTORIZADOS = ['558488045008-1401380014@g.us', '120363423496684075@g.us', '120363422121095440@g.us']; 
const ID_GRUPO_TECNICOS = '120363422121095440@g.us';

const esperaNumero = new Map(); 
const esperaConfirmacaoURA = new Map(); 

// --- INICIALIZAÇÃO DO CLIENTE (COM NO-SANDBOX PARA LINUX) ---
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ],
        headless: true
    }
});

client.on('qr', (qr) => {
    console.log('ESCANEIE O QR CODE ABAIXO:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => console.log('--- BOT ONLINE NO RENDER ---'));

client.on('message', async msg => {
    if (msg.body === '!id') { msg.reply(`ID: ${msg.from}`); return; }
    if (!GRUPOS_AUTORIZADOS.includes(msg.from)) return;

    const msgTexto = msg.body.toLowerCase().trim();
    const usuarioId = msg.author || msg.from;

    if (esperaConfirmacaoURA.has(usuarioId)) {
        const dadosPendente = esperaConfirmacaoURA.get(usuarioId);
        if (msgTexto === 'sim') {
            await enviarContatos(msg, dadosPendente.termo);
            esperaConfirmacaoURA.delete(usuarioId);
            return;
        } else if (msgTexto === 'não' || msgTexto === 'nao') {
            await msg.reply("Sr. técnico por gentileza validar na URA duas vezes antes do contato do cliente ser liberado");
            esperaConfirmacaoURA.delete(usuarioId);
            return;
        }
    }

    let termoBusca = null;
    const regex = /(?:cct|cont|contato|contatos|contrato)\D*(\d+)|(\d+)\D*(?:cct|cont|contato|contatos|contrato)/i;
    const match = msgTexto.match(regex);
    if (match) termoBusca = match[1] || match[2];

    if (termoBusca) {
        if (msg.from === ID_GRUPO_TECNICOS) {
            esperaConfirmacaoURA.set(usuarioId, { termo: termoBusca });
            await msg.reply(`Antes da liberação do contato, o Sr já confirmou com a URA? \n\nResponda apenas *Sim* ou *Não*`);
            setTimeout(() => { if (esperaConfirmacaoURA.has(usuarioId)) esperaConfirmacaoURA.delete(usuarioId); }, 60000);
        } else {
            await enviarContatos(msg, termoBusca);
        }
    }
});

async function enviarContatos(msg, termoBusca) {
    try {
        const [resNatal, resFortaleza] = await Promise.all([axios.get(URL_NATAL), axios.get(URL_FORTALEZA)]);
        const registros = [...parse(resNatal.data, {columns:true, skip_empty_lines:true, trim:true}), ...parse(resFortaleza.data, {columns:true, trim:true})];
        const encontrado = registros.find(r => r['Contrato'] === termoBusca);

        if (encontrado) {
            let resposta = `✅ *CONTATOS LIBERADOS*\n\n📄 *Contrato:* ${termoBusca}\n────────────────────\n`;
            if (encontrado['Telefone 1']) resposta += `📞 *Tel 1:* ${encontrado['Telefone 1']}\n`;
            if (encontrado['Telefone 2']) resposta += `📞 *Tel 2:* ${encontrado['Telefone 2']}\n`;
            if (encontrado['Telefone 3']) resposta += `📞 *Tel 3:* ${encontrado['Telefone 3']}\n`;
            
            // Regra de segurança: Ocultar CPF/RG [cite: 2025-12-23]
            resposta += `────────────────────\n⚠️ CPF/RG ocultos por segurança.`;
            await msg.reply(resposta);
        }
    } catch (e) { console.error("Erro na busca."); }
}

client.initialize();
