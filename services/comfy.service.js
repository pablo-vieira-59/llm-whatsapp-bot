const axios = require('axios');
const fs = require('fs');

async function waitForCompletion(promptId, timeout = 300000, interval = 2000) {
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
    // Flux Workflow 
    //const workflowRaw = fs.readFileSync('workflows/workflow_flux_api.json', 'utf-8');

    const workflowRaw = fs.readFileSync('workflows/workflow_api.json', 'utf-8');
    let workflow = JSON.parse(workflowRaw);

    // Flux workflow ID 
    //const positiveNodeId = "6";

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
    const workflowRaw = fs.readFileSync('workflows/workflow_edit_flux_api.json', 'utf-8');
    let workflow = JSON.parse(workflowRaw);

    const positiveNodeId = "10";
    if (workflow[positiveNodeId]) {
        workflow[positiveNodeId].inputs.text = promptText;
    }

    const loadImageNodeId = "5"; 
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

async function editComfyMultipleImage(promptText, msg) {

    // 🔹 Segunda imagem (mensagem atual)
    if (!msg.hasMedia || msg.type !== 'image') {
        throw new Error("Envie uma imagem respondendo outra imagem.");
    }

    // 🔹 Verifica se é reply
    if (!msg.hasQuotedMsg) {
        throw new Error("Você precisa responder a primeira imagem com a segunda.");
    }

    const quotedMsg = await msg.getQuotedMessage();

    // 🔹 Primeira imagem (mensagem respondida)
    if (!quotedMsg.hasMedia || quotedMsg.type !== 'image') {
        throw new Error("A mensagem respondida não contém uma imagem válida.");
    }

    // 🔹 Download das duas imagens
    const media1 = await quotedMsg.downloadMedia(); // Primeira
    const media2 = await msg.downloadMedia();       // Segunda

    const medias = [media1, media2];
    const uploadedFileNames = [];

    // 🔹 Upload das duas imagens
    for (let i = 0; i < medias.length; i++) {

        const imageBuffer = Buffer.from(medias[i].data, "base64");

        const blob = new Blob([imageBuffer], { type: medias[i].mimetype });

        const formData = new FormData();
        formData.append("image", blob, `input_${i}.png`);

        const uploadResponse = await axios.post(
            `http://${process.env.COMFYUI_URL}/upload/image`,
            formData
        );

        uploadedFileNames.push(uploadResponse.data.name);
    }

    // 🔹 Carrega workflow
    const workflowRaw = fs.readFileSync(
        'workflows/workflow_edit_flux_multiple_api.json',
        'utf-8'
    );

    let workflow = JSON.parse(workflowRaw);

    // 🔹 Atualiza prompt
    if (workflow["10"]) {
        workflow["10"].inputs.text = promptText;
    }

    // 🔹 Primeira imagem
    if (workflow["5"]) {
        workflow["5"].inputs.image = uploadedFileNames[0];
    }

    // 🔹 Segunda imagem
    if (workflow["27"]) {
        workflow["27"].inputs.image = uploadedFileNames[1];
    }

    // 🔹 Executa workflow
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

    const imgRes = await axios.get(
        `http://${process.env.COMFYUI_URL}/view?filename=${fileName}&type=output`,
        { responseType: 'arraybuffer' }
    );

    return {
        buffer: Buffer.from(imgRes.data).toString('base64'),
        mimeType: 'image/png'
    };
}

module.exports = { generateComfyImage, editComfyImage, editComfyMultipleImage };