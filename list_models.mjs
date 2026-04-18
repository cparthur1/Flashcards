import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = "AIzaSyBI9k_WRn_-pu4Nue2NCxM59aXgr_RI9pk";
const genAI = new GoogleGenerativeAI(apiKey);

async function list() {
    try {
        const models = await genAI.listModels();
        console.log(JSON.stringify(models, null, 2));
    } catch (e) {
        console.error(e);
    }
}

list();
