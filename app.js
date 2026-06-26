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

const SYSTEM_PROMPT = `
ROLE: Eres Tommy, Gerente de Amor y Felicidad en Fruits by Pili.

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
- NUNCA suenes robótico
- "16 oz de puro sabor", no "libra buena"
- "Pili prepara", no cocina
- "¿Deseas ordenar?" no "¿Vamos?"
- Siempre pregunta completo: "¿Cuántas ensaladas quieres ordenar?"
- NO uses "hermana/hermano"
- Lenguaje neutral (también compran hombres)
- Responde en menos de 2 minutos

CUANDO CIERRES PEDIDO:
- Pide nombre completo
- Pide dirección exacta
- Pide cantidad de ensaladas
- Pide hora aproximada
- Confirma con formato limpio
- Dile que Pili está cortando AHORA la fruta
- Estimado de entrega

CUANDO ESCALES A PILI:
- Personalización especial (sin azúcar, sin gluten, etc)
- Reclamos o problemas
- Pedidos muy grandes (6+ personas)
- Zonas nuevas (preguntar si llegamos)
- Promociones del día

TONO:
- Profesional, vendedor, cálido, colombiano
- Elegante con picardía sana
- Emocional y directo
- Cálido sin ser desesperado
`;

const RESPONSE_LIBRARY = {
  saludo_nuevo: "¡Hola! Soy Tommy 🐕\n\nYo soy el Gerente de Amor y Felicidad acá en Fruits by Pili.\n\nMi jefe Pili prepara las MEJORES ensaladas de frutas colombianas de Miami. Hechas al momento, 16 oz de puro sabor, con un gusto que no olvidas.\n\n¿En qué te podemos ayudar?",
  precio: "$15 por ensalada (16 oz de puro sabor).\n\nPero espera, aquí viene la magia:\n✓ FRUTA FRESCA (Pili trabaja con fruta fresca)\n✓ HECHA AL MOMENTO cuando la ordenas\n✓ Frutas frescas: papaya, melón, manzana, fresa, kiwi, mango, durazno, cereza\n✓ Queso, coco, la salsa dulce casera (¡el secreto de Pili!)\n✓ Galletas + HELADO 🍦\n\nEs decir: $15 por una experiencia auténtica colombiana, no solo somos fruta.\n\n¿Deseas ordenar?",
  frutas: "La ensalada COMPLETA lleva:\n🍌 Banano\n🍓 Fresa\n🥝 Kiwi\n🍊 Papaya\n🍉 Melón\n🍎 Manzana\n🥭 Mango\n🍑 Durazno en almíbar\n🍒 Cereza\n+ Queso rallado\n+ Coco rallado\n+ Salsa dulce casera ✨\n+ Galletas\n+ Helado\n\n¿Hay algo que NO quieras? Pili lo quita sin problema.",
  primera_compra: "¡PRIMERO QUE TODO: BIENVENIDO! 🎉\n\nSigue @fruitsbypili en Instagram y te damos 2 bolas de helado GRATIS con tu primer pedido.\n\nEs nuestra forma de decir: 'Pruébanos, te va a encantar.'\n\n¿Cuántas ensaladas quieres ordenar?",
  ubicacion: "No tenemos local comercial, pero tenemos un punto de recogida en Wynwood, Miami.\n\nPuedes ir a recoger tu pedido.\n\nHorario: 12pm - 9pm (recogida hasta 10pm)\n\n¿Deseas hacer una orden para recoger?",
  zona_cercana: "Perfecto, llegamos sin problema. ¿Cuál es tu dirección exacta?",
  escalar: "Ese detalle lo decide Pili directamente.\n\nTe paso con ella ahora. Ella te responde en menos de 5 minutos.\n\nUn segundo...",
};

async function generateResponse(userMessage, phoneNumber) {
  try {
    const quickResponse = searchResponseLibrary(userMessage);
    if (quickResponse) {
      console.log(`[QUICK RESPONSE] ${phoneNumber}: ${userMessage}`);
      return quickResponse;
    }

    console.log(`[CLAUDE API] ${phoneNumber}: ${userMessage}`);

    const message = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [
        { role: "user", content: userMessage }
      ]
    });

    return message.content[0].text;
  } catch (error) {
    console.error('Error generando respuesta:', error);
    return "Ay, disculpa que no puedo responder ahora. Intenta en un segundo 😔";
  }
}

function searchResponseLibrary(message) {
  const lower = message.toLowerCase();

  if (lower.includes('cuánto') || lower.includes('precio') || lower.includes('cuesta')) {
    return RESPONSE_LIBRARY.precio;
  }
  if (lower.includes('qué lleva') || lower.includes('frutas') || lower.includes('ingredientes')) {
    return RESPONSE_LIBRARY.frutas;
  }
  if (lower.includes('primera vez') || lower.includes('primera compra') || lower.includes('nuevo')) {
    return RESPONSE_LIBRARY.primera_compra;
  }
  if (lower.includes('dónde') || lower.includes('ubicación') || lower.includes('localización')) {
    return RESPONSE_LIBRARY.ubicacion;
  }
  if (message.length < 20 && (lower.includes('hola') || lower.includes('hi') || lower.includes('hey'))) {
    return RESPONSE_LIBRARY.saludo_nuevo;
  }

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
        text: {
          preview_url: false,
          body: message
        }
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );
    console.log(`[SENT] ${phoneNumber}: ${message.substring(0, 50)}...`);
  } catch (error) {
    console.error('Error enviando mensaje:', error.response?.data || error.message);
  }
}

app.post('/webhook', async (req, res) => {
  try {
    const entry = req.body.entry[0];
    const changes = entry.changes[0];
    const value = changes.value;

    if (!value.messages) {
      return res.status(200).send('ok');
    }

    const message = value.messages[0];
    const phoneNumber = message.from;
    const userText = message.text.body;
    const timestamp = message.timestamp;

    console.log(`[RECEIVED] ${phoneNumber}: ${userText}`);

    const response = await generateResponse(userText, phoneNumber);

    await sendWhatsAppMessage(phoneNumber, response);

    res.status(200).send('ok');
  } catch (error) {
    console.error('Error en webhook:', error);
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
    console.log('❌ Webhook token inválido');
    res.status(403).send('Forbidden');
  }
});

app.get('/', (req, res) => {
  res.status(200).json({
    status: 'online',
    bot: 'Tommy 🐕',
    business: 'Fruits by Pili',
    version: '1.0.0'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Tommy está en vivo en puerto ${PORT}`);
  console.log(`🐕 Gerente de Amor y Felicidad - Fruits by Pili`);
  console.log(`📍 Wynwood, Miami`);
  console.log(`⏰ Horario: 12pm - 9pm`);
});

module.exports = app;
