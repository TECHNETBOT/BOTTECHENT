const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const { parse } = require('csv-parse/sync');
const fs = require('fs');

// --- CONFIGURAÇÕES ---
const URL_NATAL = 'https://docs.google.com/spreadsheets/d/1ekbmoobOkE5CWkd5L_fIlXm1s_SUNOscy8Qh8TYahhQ/export?format=csv&gid=1613245670';
const URL_FORTALEZA = 'https://docs.google.com/spreadsheets/d/1ekbmoobOkE5CWkd5L_fIlXm1s_SUNOscy8Qh8TYahhQ/export?format=csv&gid=0';

const GRUPOS_AUTORIZADOS = ['558488045008-1401380014@g.us', '120363423496684075@g.us', '120363422121095440@g.us']; 
const ID_GRUPO_TECNICOS = '120363422121095440@g.us';
const ID_GRUPO_ALERTAS = '558488045008-1401380014@g.us';
const ID_TESTE_EXCLUSIVO = '120363423496684075@g.us';

const esperaNumero = new Map(); 
const esperaConfirmacaoURA = new Map(); 
let ultimoAlertaEnviado = "";
let ultimoAlertaVT = "";
let ultimoAlertaAD = "";
let ultimoAlertaDESC = "";

// Arquivos de marcações separados
const ARQUIVO_VT = './marcacoes_vt.json';
const ARQUIVO_AD = './marcacoes_ad.json';
const ARQUIVO_DESC = './marcacoes_desc.json';

// Função genérica para carregar marcações
const carregarMarcacoes = (arquivo) => {
    try {
        if (fs.existsSync(arquivo)) {
            const data = fs.readFileSync(arquivo, 'utf8');
            return JSON.parse(data);
        }
    } catch (err) {
        console.error(`Erro ao carregar ${arquivo}:`, err);
    }
    return [];
};

// Função genérica para salvar marcações
const salvarMarcacoes = (arquivo, lista) => {
    try {
        fs.writeFileSync(arquivo, JSON.stringify(lista, null, 2));
    } catch (err) {
        console.error(`Erro ao salvar ${arquivo}:`, err);
    }
};

let listaVT = carregarMarcacoes(ARQUIVO_VT);
let listaAD = carregarMarcacoes(ARQUIVO_AD);
let listaDESC = carregarMarcacoes(ARQUIVO_DESC);

let sock;

const enviarAlertaJanela = async (janelaHorario, idDestino) => {
    const mensagem = `🚨 *ATENÇÃO – TEC 1* 🚨\n⏰ Janela de atendimento: ${janelaHorario}\n\n⚠️ Todos os atendimentos devem ser baixados imediatamente, pois faltam apenas 15 minutos para o término da janela.\n✅ Evitem atrasos e garantam o fechamento dentro do prazo.`;
    
    try {
        await sock.sendMessage(idDestino, { text: mensagem });
    } catch (err) {
        console.error(`Erro no alerta:`, err.message);
    }
};

const enviarAlertaVT = async (janelas, idDestino) => {
    let textoJanelas = '';
    janelas.forEach(j => {
        textoJanelas += `* ${j}\n`;
    });

    let controladores = '';
    let mentions = [];
    
    if (listaVT.length > 0) {
        controladores = listaVT.map(num => `@${num}`).join(' ');
        mentions = listaVT.map(num => `${num}@s.whatsapp.net`);
    } else {
        controladores = '(Nenhum cadastrado)';
    }

    const mensagem = `🚨 *ATENÇÃO – VISITA TÉCNICA (VT)* 🚨\n⏰ *Janelas de encerramento:*\n${textoJanelas}\n👷‍♂️ *Controladores:* ${controladores}\n\n⚠️ Faltam apenas 15 minutos para o término desta janela.\n📉 Baixem os atendimentos imediatamente.\n✅ Evitem pendências.`;
    
    try {
        await sock.sendMessage(idDestino, { 
            text: mensagem,
            mentions: mentions 
        });
        console.log(`✅ Alerta VT enviado: ${janelas.join(', ')}`);
    } catch (err) {
        console.error(`Erro no alerta VT:`, err.message);
    }
};

const enviarAlertaAD = async (janelas, idDestino) => {
    let textoJanelas = '';
    janelas.forEach(j => {
        textoJanelas += `* ${j}\n`;
    });

    let controladores = '';
    let mentions = [];
    
    if (listaAD.length > 0) {
        controladores = listaAD.map(num => `@${num}`).join(' ');
        mentions = listaAD.map(num => `${num}@s.whatsapp.net`);
    } else {
        controladores = '(Nenhum cadastrado)';
    }

    const mensagem = `🚨 *ATENÇÃO – ADESÃO* 🚨\n⏰ *Janelas de encerramento:*\n${textoJanelas}\n👷‍♂️ *Controladores:* ${controladores}\n\n⚠️ Faltam apenas 15 minutos para o término desta janela.\n📉 Baixem os atendimentos imediatamente.\n✅ Evitem pendências.`;
    
    try {
        await sock.sendMessage(idDestino, { 
            text: mensagem,
            mentions: mentions 
        });
        console.log(`✅ Alerta ADESÃO enviado: ${janelas.join(', ')}`);
    } catch (err) {
        console.error(`Erro no alerta ADESÃO:`, err.message);
    }
};

const enviarAlertaDESC = async (janelas, idDestino) => {
    let textoJanelas = '';
    janelas.forEach(j => {
        textoJanelas += `* ${j}\n`;
    });

    let controladores = '';
    let mentions = [];
    
    if (listaDESC.length > 0) {
        controladores = listaDESC.map(num => `@${num}`).join(' ');
        mentions = listaDESC.map(num => `${num}@s.whatsapp.net`);
    } else {
        controladores = '(Nenhum cadastrado)';
    }

    const mensagem = `🚨 *ATENÇÃO – DESCONEXÃO* 🚨\n⏰ *Janelas de encerramento:*\n${textoJanelas}\n👷‍♂️ *Controladores:* ${controladores}\n\n⚠️ Faltam apenas 15 minutos para o término desta janela.\n📉 Baixem os atendimentos imediatamente.\n✅ Evitem pendências.`;
    
    try {
        await sock.sendMessage(idDestino, { 
            text: mensagem,
            mentions: mentions 
        });
        console.log(`✅ Alerta DESCONEXÃO enviado: ${janelas.join(', ')}`);
    } catch (err) {
        console.error(`Erro no alerta DESCONEXÃO:`, err.message);
    }
};

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_baileys');

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'fatal' }),
        browser: ['Bot Consulta', 'Chrome', '1.0.0'],
        markOnlineOnConnect: false
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('\n🔸 Escaneie o QR Code abaixo:\n');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom)
                ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
                : true;

            console.log('⚠️ Conexão fechada, reconectando...', shouldReconnect);

            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('--- BOT CONSULTA ATIVO (TEC1 + VT + AD + DESC) ---');
            console.log(`📋 VT: ${listaVT.length} | AD: ${listaAD.length} | DESC: ${listaDESC.length}`);

            // Inicia verificação de horários
            setInterval(() => {
                const agora = new Date();
                const horaAtual = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });

                // ========== ALERTAS TEC 1 ==========
                const horariosAlertaTec1 = {
                    "11:45": "das 08h às 12h",
                    "14:45": "das 12h às 15h",
                    "17:45": "das 15h às 18h"
                };

                if (horariosAlertaTec1[horaAtual] && ultimoAlertaEnviado !== horaAtual) {
                    enviarAlertaJanela(horariosAlertaTec1[horaAtual], ID_GRUPO_ALERTAS);
                    ultimoAlertaEnviado = horaAtual; 
                }

                // ========== ALERTAS VT ==========
                const horariosAlertaVT = {
                    "09:45": ["08:00 às 10:00"],
                    "10:45": ["08:00 às 11:00"],
                    "11:45": ["10:00 às 12:00"],
                    "13:45": ["11:00 às 14:00", "12:00 às 14:00"],
                    "15:45": ["14:00 às 16:00"],
                    "16:45": ["14:00 às 17:00"],
                    "17:45": ["16:00 às 18:00"],
                    "19:45": ["17:00 às 20:00", "18:00 às 20:00"]
                };

                if (horariosAlertaVT[horaAtual] && ultimoAlertaVT !== horaAtual) {
                    enviarAlertaVT(horariosAlertaVT[horaAtual], ID_GRUPO_ALERTAS);
                    ultimoAlertaVT = horaAtual;
                }

                // ========== ALERTAS ADESÃO ==========
                const horariosAlertaAD = {
                    "11:45": ["08:00 às 12:00"],
                    "14:45": ["12:00 às 15:00"],
                    "17:45": ["15:00 às 18:00"]
                };

                if (horariosAlertaAD[horaAtual] && ultimoAlertaAD !== horaAtual) {
                    enviarAlertaAD(horariosAlertaAD[horaAtual], ID_GRUPO_ALERTAS);
                    ultimoAlertaAD = horaAtual;
                }

                // ========== ALERTAS DESCONEXÃO (adicionar depois) ==========
                // const horariosAlertaDESC = {};
                // if (horariosAlertaDESC[horaAtual] && ultimoAlertaDESC !== horaAtual) {
                //     enviarAlertaDESC(horariosAlertaDESC[horaAtual], ID_GRUPO_ALERTAS);
                //     ultimoAlertaDESC = horaAtual;
                // }

            }, 30000);
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        try {
            const m = messages[0];
            if (type !== 'notify' || m.key.fromMe) return;

            const msgTextoRaw = m.message?.conversation || m.message?.extendedTextMessage?.text || '';
            const msgTexto = msgTextoRaw.toLowerCase().trim();
            const chatId = m.key.remoteJid;
            const usuarioId = m.key.participant || chatId;

            // ==================== COMANDOS VT ====================
            if (msgTexto.startsWith('!addvt ')) {
                const numero = msgTextoRaw.slice(7).trim().replace(/\D/g, '');
                
                if (numero.length < 10) {
                    await sock.sendMessage(chatId, { text: '❌ Número inválido. Use: !addvt 5584999999999' });
                    return;
                }

                if (listaVT.includes(numero)) {
                    await sock.sendMessage(chatId, { text: `⚠️ O número *${numero}* já está na lista VT.` });
                    return;
                }

                listaVT.push(numero);
                salvarMarcacoes(ARQUIVO_VT, listaVT);
                await sock.sendMessage(chatId, { text: `✅ *VT* - Número *${numero}* adicionado!\n📋 Total: ${listaVT.length}` });
                return;
            }

            if (msgTexto.startsWith('!unaddvt ')) {
                const numero = msgTextoRaw.slice(9).trim().replace(/\D/g, '');
                
                const index = listaVT.indexOf(numero);
                if (index === -1) {
                    await sock.sendMessage(chatId, { text: `⚠️ Número *${numero}* não está na lista VT.` });
                    return;
                }

                listaVT.splice(index, 1);
                salvarMarcacoes(ARQUIVO_VT, listaVT);
                await sock.sendMessage(chatId, { text: `✅ *VT* - Número *${numero}* removido!\n📋 Total: ${listaVT.length}` });
                return;
            }

            if (msgTexto === '!listavt') {
                if (listaVT.length === 0) {
                    await sock.sendMessage(chatId, { text: '📋 *VT* - Nenhum controlador cadastrado.' });
                    return;
                }

                let resposta = '📋 *CONTROLADORES VT:*\n\n';
                listaVT.forEach((num, i) => {
                    resposta += `${i + 1}. ${num}\n`;
                });
                resposta += `\n✅ Total: ${listaVT.length}`;
                await sock.sendMessage(chatId, { text: resposta });
                return;
            }

            // ==================== COMANDOS ADESÃO ====================
            if (msgTexto.startsWith('!addad ')) {
                const numero = msgTextoRaw.slice(7).trim().replace(/\D/g, '');
                
                if (numero.length < 10) {
                    await sock.sendMessage(chatId, { text: '❌ Número inválido. Use: !addad 5584999999999' });
                    return;
                }

                if (listaAD.includes(numero)) {
                    await sock.sendMessage(chatId, { text: `⚠️ O número *${numero}* já está na lista ADESÃO.` });
                    return;
                }

                listaAD.push(numero);
                salvarMarcacoes(ARQUIVO_AD, listaAD);
                await sock.sendMessage(chatId, { text: `✅ *ADESÃO* - Número *${numero}* adicionado!\n📋 Total: ${listaAD.length}` });
                return;
            }

            if (msgTexto.startsWith('!unaddad ')) {
                const numero = msgTextoRaw.slice(9).trim().replace(/\D/g, '');
                
                const index = listaAD.indexOf(numero);
                if (index === -1) {
                    await sock.sendMessage(chatId, { text: `⚠️ Número *${numero}* não está na lista ADESÃO.` });
                    return;
                }

                listaAD.splice(index, 1);
                salvarMarcacoes(ARQUIVO_AD, listaAD);
                await sock.sendMessage(chatId, { text: `✅ *ADESÃO* - Número *${numero}* removido!\n📋 Total: ${listaAD.length}` });
                return;
            }

            if (msgTexto === '!listaad') {
                if (listaAD.length === 0) {
                    await sock.sendMessage(chatId, { text: '📋 *ADESÃO* - Nenhum controlador cadastrado.' });
                    return;
                }

                let resposta = '📋 *CONTROLADORES ADESÃO:*\n\n';
                listaAD.forEach((num, i) => {
                    resposta += `${i + 1}. ${num}\n`;
                });
                resposta += `\n✅ Total: ${listaAD.length}`;
                await sock.sendMessage(chatId, { text: resposta });
                return;
            }

            // ==================== COMANDOS DESCONEXÃO ====================
            if (msgTexto.startsWith('!adddesc ')) {
                const numero = msgTextoRaw.slice(9).trim().replace(/\D/g, '');
                
                if (numero.length < 10) {
                    await sock.sendMessage(chatId, { text: '❌ Número inválido. Use: !adddesc 5584999999999' });
                    return;
                }

                if (listaDESC.includes(numero)) {
                    await sock.sendMessage(chatId, { text: `⚠️ O número *${numero}* já está na lista DESCONEXÃO.` });
                    return;
                }

                listaDESC.push(numero);
                salvarMarcacoes(ARQUIVO_DESC, listaDESC);
                await sock.sendMessage(chatId, { text: `✅ *DESCONEXÃO* - Número *${numero}* adicionado!\n📋 Total: ${listaDESC.length}` });
                return;
            }

            if (msgTexto.startsWith('!unadddesc ')) {
                const numero = msgTextoRaw.slice(11).trim().replace(/\D/g, '');
                
                const index = listaDESC.indexOf(numero);
                if (index === -1) {
                    await sock.sendMessage(chatId, { text: `⚠️ Número *${numero}* não está na lista DESCONEXÃO.` });
                    return;
                }

                listaDESC.splice(index, 1);
                salvarMarcacoes(ARQUIVO_DESC, listaDESC);
                await sock.sendMessage(chatId, { text: `✅ *DESCONEXÃO* - Número *${numero}* removido!\n📋 Total: ${listaDESC.length}` });
                return;
            }

            if (msgTexto === '!listadesc') {
                if (listaDESC.length === 0) {
                    await sock.sendMessage(chatId, { text: '📋 *DESCONEXÃO* - Nenhum controlador cadastrado.' });
                    return;
                }

                let resposta = '📋 *CONTROLADORES DESCONEXÃO:*\n\n';
                listaDESC.forEach((num, i) => {
                    resposta += `${i + 1}. ${num}\n`;
                });
                resposta += `\n✅ Total: ${listaDESC.length}`;
                await sock.sendMessage(chatId, { text: resposta });
                return;
            }

            // ==================== COMANDOS DE TESTE ====================
            if (msgTexto === '!teste') {
                await enviarAlertaJanela("TESTE SONORO", chatId);
                return;
            }

            if (msgTexto === '!testevt') {
                await enviarAlertaVT(['08:00 às 10:00 (Teste)', '08:00 às 11:00 (Teste)'], chatId);
                return;
            }

            if (msgTexto === '!testead') {
                await enviarAlertaAD(['08:00 às 12:00 (Teste)', '12:00 às 15:00 (Teste)', '15:00 às 18:00 (Teste)'], chatId);
                return;
            }

            if (msgTexto === '!testedesc') {
                await enviarAlertaDESC(['Janela Teste'], chatId);
                return;
            }

            // ==================== MENU DE COMANDOS ====================
            if (msgTexto === '!comandos' || msgTexto === '!ajuda' || msgTexto === '!help') {
                const menuComandos = `📋 *MENU DE COMANDOS DO BOT*

🔹 *VISITA TÉCNICA (VT)*
• !addvt 5584999999999 - Adiciona controlador VT
• !unaddvt 5584999999999 - Remove controlador VT
• !listavt - Lista todos controladores VT
• !testevt - Testa alerta VT

🔹 *ADESÃO (AD)*
• !addad 5584999999999 - Adiciona controlador Adesão
• !unaddad 5584999999999 - Remove controlador Adesão
• !listaad - Lista todos controladores Adesão
• !testead - Testa alerta Adesão

🔹 *DESCONEXÃO (DESC)*
• !adddesc 5584999999999 - Adiciona controlador Desconexão
• !unadddesc 5584999999999 - Remove controlador Desconexão
• !listadesc - Lista todos controladores Desconexão
• !testedesc - Testa alerta Desconexão

🔹 *TESTES & OUTROS*
• !teste - Testa alerta TEC1
• !comandos - Mostra este menu

📞 *CONSULTA DE CONTRATOS*
• Digite o número do contrato
• Exemplos: "contrato 12345" ou "12345"

⚙️ *ALERTAS AUTOMÁTICOS*
• TEC1: 11:45, 14:45, 17:45
• VT: 09:45, 10:45, 11:45, 13:45, 15:45, 16:45, 17:45, 19:45
• ADESÃO: 11:45, 14:45, 17:45`;

                await sock.sendMessage(chatId, { text: menuComandos });
                return;
            }

            if (!GRUPOS_AUTORIZADOS.includes(chatId)) return;

            // --- LOGICA DA URA ---
            if (esperaConfirmacaoURA.has(usuarioId)) {
                const dadosPendente = esperaConfirmacaoURA.get(usuarioId);
                if (msgTexto === 'sim') {
                    await exibirDadosContrato(chatId, dadosPendente.dados, dadosPendente.termo, m);
                    esperaConfirmacaoURA.delete(usuarioId);
                    return;
                } else if (msgTexto === 'não' || msgTexto === 'nao') {
                    await sock.sendMessage(chatId, { text: "Sr. técnico por gentileza validar na URA duas vezes antes do contato do cliente ser liberado" }, { quoted: m });
                    esperaConfirmacaoURA.delete(usuarioId);
                    return;
                }
            }

            // --- BUSCA DE CONTRATO ---
            const regex = /(?:cct|cont|contato|contatos|contrato)\D*(\d+)|(\d+)\D*(?:cct|cont|contato|contatos|contrato)/i;
            const match = msgTexto.match(regex);
            if (match) {
                const termo = match[1] || match[2];
                try {
                    const [resN, resF] = await Promise.all([
                        axios.get(URL_NATAL, { timeout: 10000 }),
                        axios.get(URL_FORTALEZA, { timeout: 10000 })
                    ]);
                    
                    const base = [
                        ...parse(resN.data, {columns:true, skip_empty_lines:true, trim:true}), 
                        ...parse(resF.data, {columns:true, trim:true})
                    ];
                    
                    const achado = base.find(r => r['Contrato'] === termo);

                    if (achado) {
                        if (chatId === ID_GRUPO_TECNICOS) {
                            esperaConfirmacaoURA.set(usuarioId, { termo, dados: achado, messageKey: m.key });
                            await sock.sendMessage(chatId, { text: `📄 *Contrato:* ${termo}\nJá confirmou com a URA? \n\nResponda apenas *Sim* ou *Não*` }, { quoted: m });
                        } else {
                            await exibirDadosContrato(chatId, achado, termo, m);
                        }
                    } else {
                        if (chatId === ID_GRUPO_TECNICOS) {
                            await sock.sendMessage(chatId, { text: "❌ CONTRATO NÃO ENCONTRADO, POR FAVOR ENTRE EM CONTATO COM UM CONTROLADOR" }, { quoted: m });
                        } else if (chatId === ID_GRUPO_ALERTAS) {
                            await sock.sendMessage(chatId, { react: { text: '❌', key: m.key } });
                        }
                    }
                } catch (e) { 
                    console.error("Erro na planilha:", e.message);
                    
                    // Informa o erro no chat
                    if (chatId === ID_GRUPO_TECNICOS || chatId === ID_GRUPO_ALERTAS) {
                        await sock.sendMessage(chatId, { 
                            text: `⚠️ Erro ao buscar contrato *${termo}*\n\nMotivo: ${e.message}\n\nTente novamente em alguns segundos.`
                        }, { quoted: m });
                    }
                }
            }
        } catch (error) {
            console.error('❌ Erro ao processar mensagem:', error);
        }
    });

    return sock;
}

async function exibirDadosContrato(chatId, encontrado, termoBusca, message) {
    let resposta = '';
    
    // Se for grupo de TÉCNICOS, mostra mensagem completa
    if (chatId === ID_GRUPO_TECNICOS) {
        resposta = `✅ *CONTATOS LIBERADOS* \n\n`;
        resposta += `📄 *Contrato:* ${termoBusca}\n`;
        resposta += `────────────────────\n`;
        if (encontrado['Telefone 1']) resposta += `📞 *Tel 1:* ${encontrado['Telefone 1']}\n`;
        if (encontrado['Telefone 2']) resposta += `📞 *Tel 2:* ${encontrado['Telefone 2']}\n`;
        if (encontrado['Telefone 3']) resposta += `📞 *Tel 3:* ${encontrado['Telefone 3']}\n`;
        resposta += `\nCaso não consiga contato o cliente, por favor retornar para o controlador com evidências(foto,video...)`;
    } else {
        // Para CONTROLADORES, mensagem limpa
        resposta = `📄 *Contrato:* ${termoBusca}\n`;
        resposta += `────────────────────\n`;
        if (encontrado['Telefone 1']) resposta += `📞 *Tel 1:* ${encontrado['Telefone 1']}\n`;
        if (encontrado['Telefone 2']) resposta += `📞 *Tel 2:* ${encontrado['Telefone 2']}\n`;
        if (encontrado['Telefone 3']) resposta += `📞 *Tel 3:* ${encontrado['Telefone 3']}`;
    }
    
    // Envia com quote (marcação) - estrutura correta do Baileys
    await sock.sendMessage(chatId, { text: resposta }, { quoted: message });
}

console.log('🚀 Iniciando bot com Baileys...\n');
connectToWhatsApp();
