const axios = require('axios');
const fs = require('fs');

async function waitForCompletion(promptId, timeout = 180000, interval = 2000) {
    const start = Date.now();

    while (true) {
        // Timeout
        if (Date.now() - start > timeout) {
            throw new Error("Tempo esgotado esperando o ComfyUI.");
        }

        try {
            const res = await axios.get(
                `http://${process.env.COMFYUI_URL}/history/${promptId}`
            );

            const history = res.data;

            if (history[promptId] && history[promptId].outputs) {
                return history[promptId].outputs;
            }

        } catch (err) {
            console.log("Ainda não pronto...");
        }

        await new Promise(r => setTimeout(r, interval));
    }
}

async function generateComfyImage(promptText) {
    const workflowRaw = fs.readFileSync('workflows/workflow_api.json', 'utf-8');
    let workflow = JSON.parse(workflowRaw);

    const positiveNodeId = "8";
    if (workflow[positiveNodeId]) {
        workflow[positiveNodeId].inputs.text = promptText;
    }

    // Envia prompt
    const response = await axios.post(
        `http://${process.env.COMFYUI_URL}/prompt`,
        { prompt: workflow }
    );

    const promptId = response.data.prompt_id;

    // Espera finalizar
    const outputs = await waitForCompletion(promptId);

    // Encontra o node que tem imagem
    const nodeOutput = Object.values(outputs).find(o => o.images);

    if (!nodeOutput) {
        throw new Error("Nenhuma imagem encontrada.");
    }

    const fileName = nodeOutput.images[0].filename;

    // Baixa imagem
    const imgRes = await axios.get(
        `http://${process.env.COMFYUI_URL}/view?filename=${fileName}&type=output`,
        { responseType: 'arraybuffer' }
    );

    return {
        buffer: Buffer.from(imgRes.data).toString('base64'),
        mimeType: 'image/png'
    };
}

async function editComfyImage(promptText, msg) {

    if (!msg.hasMedia) {
        throw new Error("A mensagem não contém mídia.");
    }

    const media = await msg.downloadMedia();

    if (!media || !media.mimetype.startsWith("image/")) {
        throw new Error("A mídia enviada não é uma imagem.");
    }

    // Converte base64 para buffer
    const imageBuffer = Buffer.from(media.data, "base64");

    // 1️⃣ Upload da imagem para o ComfyUI
    const blob = new Blob([imageBuffer], { type: media.mimetype });

    const formData = new FormData();
    formData.append("image", blob, "input.png");

    const uploadResponse = await axios.post(
        `http://${process.env.COMFYUI_URL}/upload/image`,
        formData
    );

    const uploadedFileName = uploadResponse.data.name;

    // 2️⃣ Carrega workflow
    const workflowRaw = fs.readFileSync('workflows/workflow_edit_api.json', 'utf-8');
    let workflow = JSON.parse(workflowRaw);

    const positiveNodeId = "10";
    if (workflow[positiveNodeId]) {
        workflow[positiveNodeId].inputs.prompt = promptText;
    }

    const loadImageNodeId = "15"; 
    if (workflow[loadImageNodeId]) {
        workflow[loadImageNodeId].inputs.image = uploadedFileName;
    }

    const response = await axios.post(
        `http://${process.env.COMFYUI_URL}/prompt`,
        { prompt: workflow }
    );

    const promptId = response.data.prompt_id;

    const outputs = await waitForCompletion(promptId);

    const nodeOutput = Object.values(outputs).find(o => o.images);

    if (!nodeOutput) {
        throw new Error("Nenhuma imagem encontrada.");
    }

    const fileName = nodeOutput.images[0].filename;

    // 5️⃣ Baixa imagem final
    const imgRes = await axios.get(
        `http://${process.env.COMFYUI_URL}/view?filename=${fileName}&type=output`,
        { responseType: 'arraybuffer' }
    );

    return {
        buffer: Buffer.from(imgRes.data).toString('base64'),
        mimeType: 'image/png'
    };
}

module.exports = { generateComfyImage, editComfyImage };