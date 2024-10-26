import dotenv from 'dotenv';
import axios from 'axios';
import colors from 'colors';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_TIMEOUT = 15000;
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0";

const delay = async (ms, message = '') => {
    if (message) {
        console.log(`⏳ ${message}`.yellow);
    }
    await new Promise(resolve => setTimeout(resolve, ms));
};

async function fetch(url, method, token = null, body = null) {
    try {
        const config = {
            method,
            url,
            timeout: API_TIMEOUT,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
                'Lang': 'en',
                'Origin': 'https://telegram.blum.codes',
                'User-Agent': USER_AGENT,
                'Sec-Ch-Ua': '"Microsoft Edge";v="129", "Not=A?Brand";v="8", "Chromium";v="129", "Microsoft Edge WebView2";v="129"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Windows"',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-site',
                ...(token && { Authorization: token })
            },
            ...(body && { data: body })
        };

        const response = await axios(config);
        return response.data;
    } catch (error) {
        console.error('Fetch error:', error?.response?.data || error.message);
        throw error?.response?.data || error;
    }
}

function extractAuthFromUrl(url) {
    try {
        const parsedUrl = new URL(url);
        const hashParams = new URLSearchParams(parsedUrl.hash.slice(1));
        const tgWebAppData = hashParams.get('tgWebAppData');
        
        if (!tgWebAppData) {
            throw new Error("WebApp data not found in URL");
        }

        return tgWebAppData;
    } catch (error) {
        console.error(`Failed to extract auth from URL: ${error.message}`.red);
        return null;
    }
}

async function getToken(webAppData) {
    try {
        const { data } = await axios({
            url: 'https://user-domain.blum.codes/api/v1/auth/provider/PROVIDER_TELEGRAM_MINI_APP',
            method: 'POST',
            data: {
                query: webAppData,
                referralToken: '554eWV40LM',
            },
            timeout: API_TIMEOUT,
        });
        if (data && data.token && data.token.access) {
            console.log('✅ Token successfully retrieved.'.green);
            return `Bearer ${data.token.access}`;
        } else {
            console.error('❌ Failed to retrieve a valid token.'.red);
            return null;
        }
    } catch (error) {
        console.error(`❌ Error occurred while fetching token: ${error.message}`.red);
        return null;
    }
}

async function playSingleGame(token, gameNumber) {
    try {
        console.log(`[Game ${gameNumber}] 🎮 Starting...`.cyan);
        
        const playResponse = await fetch(
            'https://game-domain.blum.codes/api/v2/game/play',
            'POST',
            token
        );
        
        const gameId = playResponse.gameId;
        const points = Math.floor(Math.random() * (199 - 250 + 1)) + 250;
        
        console.log(`[Game ${gameNumber}] 🎲 Game ID: ${gameId}`.cyan);
        console.log(`[Game ${gameNumber}] 🎯 Target points: ${points}`.cyan);

        await delay(33000, `[Game ${gameNumber}] Simulating gameplay...`);

        console.log(`[Game ${gameNumber}] 📡 Getting payload...`.cyan);
        const payloadResponse = await axios.post(
            'https://blum-payload-generator.hariistimewa.my.id/process?apiKey=etl1',
            {
                gameId: gameId,
                earnedAssets: {
                    'CLOVER': {
                        amount: points.toString()
                    }
                }
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache',
                    'Lang': 'en',
                    'Origin': 'https://telegram.blum.codes',
                    'User-Agent': USER_AGENT
                }
            }
        );

        const payload = payloadResponse.data?.pack?.hash;
        if (!payload) {
            throw new Error('No payload pack received from generator');
        }   
        
        console.log(`[Game ${gameNumber}] 📤 Submitting claim...`.cyan);
        const claimResponse = await fetch(
            'https://game-domain.blum.codes/api/v2/game/claim',
            'POST',
            token,
            { payload }
        );
        
        console.log(`[Game ${gameNumber}] ✅ Claimed: ${points} points`.green);
        return true;
        
    } catch (error) {
        console.error(`[Game ${gameNumber}] ❌ Error:`.red);
        console.error(error);
        
        if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
            console.error('Response headers:', error.response.headers);
        }
        
        return false;
    }
}

async function processGamesParallel(token, numGames) {
    console.log(`🚀 Starting ${numGames} games in parallel...`.cyan);
    
    const gamePromises = Array.from({ length: numGames }, (_, i) => 
        playSingleGame(token, i + 1)
    );
    
    const results = await Promise.all(gamePromises);
    
    const successCount = results.filter(result => result).length;
    console.log(`🏁 Games completed! Success: ${successCount}/${numGames}`.green);
}

async function main() {
    const url = process.argv[2];
    const numGames = parseInt(process.argv[3]) || 1;

    if (!url) {
        console.error('Please provide a URL as an argument.'.red);
        console.log('Usage: node script.js "URL" number_of_games'.yellow);
        process.exit(1);
    }

    try {
        const webAppData = extractAuthFromUrl(url);
        if (!webAppData) {
            throw new Error("Failed to extract authentication data from URL");
        }

        const token = await getToken(webAppData);
        if (!token) {
            throw new Error("Failed to get authentication token");
        }

        await processGamesParallel(token, numGames);
    } catch (error) {
        console.error(`Script execution failed: ${error.message}`.red);
        process.exit(1);
    }
}

process.on('SIGINT', () => {
    console.log("\nReceived interrupt signal. Stopping the script...".yellow);
    process.exit(0);
});

main();
