require('dotenv').config();
const express = require('express');
const axios = require('axios');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(express.json());

const WHATSAPP_TOKEN = process.env.WHATSAPP_BUSINESS_ACCESS_TOKEN;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_BUSINESS_PHONE_NUMBER_ID;
const WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'fruits_by_pili_2024';
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

const client = new Anthropic({
  apiKey: CLAUDE_API_KEY
});

const SYSTEM_PROMPT = `ROLE: Eres Tommy, Gerente de Amor y Felicidad en Fruits by Pili.

OBJETIVO:
1. Responder rápido (< 2 minutos)
2. Generar antojo (vender experiencia auténtica colombiana)
3. Cerrar pedidos completos
4. Recopilar data (zona, preferencias, nombre)
5. Escalar a Pili cuando sea necesario

PERSONALIDAD:
- Tierno pero vendedor
- Colombiano con humor natural
- Inteligente emocionalmente
- Eres Tommy, el perrito Shih Tzu

PRODUCTO:
- 16 oz de puro sabor
- Ensaladas de frutas frescas (papaya, melón, manzana, fresa, kiwi, mango, durazno, cereza)
- Queso rallado, coco rallado, salsa dulce casera, galletas, helado
- PRECIO: $15 por ensalada
- Hecha AL MOMENTO (Pili prepara cuando la ordenas)
- Fruta FRESCA (no vieja)

UBICACIÓN:
- No tenemos local comercial, punto de recogida en Wynwood
- Horario: 12pm - 9pm (recogida hasta 10pm)
- Delivery en zonas: Kendall, Doral, Downtown, Aventura, Sunny Isles, Hallandale, Hollywood

RESTRICCIONES:
- NUNCA bajes precio sin razón
- "16 oz de puro sabor", no "libra buena"
- "Pili prepara", no cocina
- "¿Deseas ordenar?" no "¿Vamos?"
- Siempre pregunta completo: "¿Cuántas ensaladas quieres ordenar?"
- NO uses "hermana/hermano"
- Lenguaje neutral
- Responde en menos de 2 minutos`;

const RESPONSE_LIBRARY = {
  saludo_nuevo: "¡Hola! Soy Tommy 🐕\n\nYo soy el Gerente de Amor y Felicidad acá en Fruits by Pili.\n\n¿En qué te podemos ayudar?",
  precio: "$15 por ensalada (16 oz de puro sabor).\n\n✓ FRUTA FRESCA\n✓ HECHA AL MOMENTO\n✓ Papaya, melón, manzana, fresa, kiwi, mango, durazno, cereza\n✓ Queso, coco, salsa dulce casera\n✓ Galletas + HELADO 🍦\n\n¿Deseas ordenar?",
  frutas: "La ensalada COMPLETA lleva:\n🍌 Banano\n🍓 Fresa\n🥝 Kiwi\n🍊 Papaya\n🍉 Melón\n🍎 Manzana\n🥭 Mango\n🍑 Durazno en almíbar\n🍒 Cereza\n+ Queso rallado\n+ Coco rallado\n+ Salsa dulce casera\n+ Galletas\n+ Helado",
  primera_compra: "¡BIENVENIDO! 🎉\n\nSigue @fruitsbypili en Instagram y te damos 2 bolas de helado GRATIS.\n\n¿Cuántas ensaladas quieres?",
  ubicacion: "No tenemos local, pero punto de recogida en Wynwood.\n\nHorario: 12pm - 9pm\n\n¿Deseas hacer una orden?",
  escalar: "Ese detalle lo decide Pili.\n\nTe paso con ella ahora. Responde en menos de 5 minutos."
};

async function generateResponse(userMessage, phoneNumber) {
  try {
    const quickResponse = searchResponseLibrary(userMessage);
    if (quickResponse) {
      console.log(`[QUICK] ${phoneNumber}: ${userMessage}`);
      return quickResponse;
    }

    console.log(`[CLAUDE] ${phoneNumber}: ${userMessage}`);
    const message = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }]
    });

    return message.content[0].text;
  } catch (error) {
    console.error('Error:', error);
    return "Disculpa, intenta de nuevo en un segundo 😔";
  }
}

function searchResponseLibrary(message) {
  const lower = message.toLowerCase();
  if (lower.includes('cuánto') || lower.includes('precio') || lower.includes('cuesta')) return RESPONSE_LIBRARY.precio;
  if (lower.includes('qué lleva') || lower.includes('frutas')) return RESPONSE_LIBRARY.frutas;
  if (lower.includes('primera')) return RESPONSE_LIBRARY.primera_compra;
  if (lower.includes('dónde') || lower.includes('ubicación')) return RESPONSE_LIBRARY.ubicacion;
  if (message.length < 20 && (lower.includes('hola') || lower.includes('hi'))) return RESPONSE_LIBRARY.saludo_nuevo;
  return null;
}

async function sendWhatsAppMessage(phoneNumber, message) {
  try {
    await axios.post(
      `https://graph.instagram.com/v18.0/${WHATSAPP_PHONE_ID}/messages`,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: phoneNumber,
        type: "text",
        text: { preview_url: false, body: message }
      },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
    );
    console.log(`[SENT] ${phoneNumber}`);
  } catch (error) {
    console.error('Error enviando:', error.response?.data || error.message);
  }
}

app.post('/webhook', async (req, res) => {
  try {
    const entry = req.body.entry[0];
    const changes = entry.changes[0];
    const value = changes.value;

    if (!value.messages) return res.status(200).send('ok');

    const message = value.messages[0];
    const phoneNumber = message.from;
    const userText = message.text.body;

    console.log(`[RECEIVED] ${phoneNumber}: ${userText}`);
    const response = await generateResponse(userText, phoneNumber);
    await sendWhatsAppMessage(phoneNumber, response);
    res.status(200).send('ok');
  } catch (error) {
    console.error('Error webhook:', error);
    res.status(200).send('ok');
  }
});

app.get('/webhook', (req, res) => {
  const verifyToken = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (verifyToken === WEBHOOK_VERIFY_TOKEN) {
    console.log('✅ Webhook verificado');
    res.status(200).send(challenge);
  } else {
    res.status(403).send('Forbidden');
  }
});

app.get('/', (req, res) => {
  res.status(200).json({ status: 'online', bot: 'Tommy 🐕', business: 'Fruits by Pili', version: '1.0.0' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Tommy en vivo en puerto ${PORT}`);
});

module.exports = app;