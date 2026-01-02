const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        // Configuração obrigatória para rodar no Render
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome'
    }
});

client.on('qr', (qr) => {
    // O QR Code aparecerá nos Logs do Render
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Bot está online e pronto!');
});

// Exemplo de função de filtro para aplicar as regras de segurança
function filtrarDados(dados) {
    return dados
        .filter(item => item.nome !== 'ELAILSON') // Remove o Elailson da lista [cite: 2025-12-23]
        .map(item => {
            const { CPF, RG, ...resto } = item; // Remove CPF e RG [cite: 2025-12-23]
            return resto;
        });
}

client.initialize();
