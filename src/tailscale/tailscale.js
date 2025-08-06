export function copyScript() {
    const scriptOutput = document.getElementById("scriptOutput");
    navigator.clipboard
        .writeText(scriptOutput.textContent)
        .then(() => {
            const originalText = document.getElementById("copyButton").textContent;
            document.getElementById("copyButton").textContent = "복사 완료! ✅";
            setTimeout(() => {
                document.getElementById("copyButton").textContent = originalText;
            }, 1000);
        })
        .catch((err) => {
            console.error("복사 실패:", err);
        });
}

/**
 * 
 * @param {string?} str 
 * @returns {boolean}
 */
function stringAsBoolean(str) {
    switch (str) {
        case null:
        case "undefined":
        case "null":
        case "0":
        case "": // 빈 문자열도 포함
            return false;
        default:
            return true;
    }
}


function getParamFromQuerystring() {
    const params = new URLSearchParams(window.location.search);
    document.getElementById('clientId').value = params.get('clientId') || '';
    document.getElementById('clientSecret').value = params.get('clientSecret') || '';
    document.getElementById('tailnetName').value = params.get('tailnetName') || '';
    document.getElementById('corsProxy').value = params.get('corsProxy') || '';
    document.getElementById('isEphemeral').checked = stringAsBoolean(params.get('isEphemeral'));
}


export function generateSync() {
    /**
     * @type {HTMLButtonElement}
     */
    const copyButton = document.getElementById('generate');
    if (!copyButton.disabled)
        generate()
}

async function generate() {
    const clientId = document.getElementById('clientId').value.trim();
    const clientSecret = document.getElementById('clientSecret').value.trim();
    const tailnetName = document.getElementById('tailnetName').value.trim();
    const corsProxy = document.getElementById('corsProxy').value.trim();
    const isEphemeral = document.getElementById('isEphemeral').checked;
    const statusMessage = document.getElementById('statusMessage');
    const scriptOutput = document.getElementById('scriptOutput');
    const copyButton = document.getElementById('copyButton');

    statusMessage.textContent = '';
    scriptOutput.textContent = 'API 액세스 토큰을 받는 중... ⏳';
    copyButton.disabled = true;

    if (!clientId || !clientSecret || !tailnetName || !corsProxy) {
        statusMessage.textContent = '모든 필드를 입력해 주세요! 😠';
        statusMessage.className = 'error';
        scriptOutput.textContent = 'Auth Key를 생성하면 여기에 스크립트가 나타날 거야! 🚀';
        return;
    }

    const accessToken = await generateAccessToken(corsProxy, clientId, clientSecret);

    statusMessage.textContent = 'API 액세스 토큰을 받았어! 이제 Auth Key를 생성할게... ✨';
    scriptOutput.textContent = 'Auth Key를 생성하는 중... ⏳';

    const authKey = await generateAuthKey(corsProxy, accessToken, tailnetName, isEphemeral)


    const script = `curl -fsSL https://tailscale.com/install.sh | sh && sudo tailscale up --advertise-exit-node --hostname=vast --ssh ${authKey}`;

    scriptOutput.textContent = script;
    statusMessage.textContent = "Auth Key 생성 및 스크립트 작성이 완료되었어! 🎉";
    statusMessage.className = "success";

    copyButton.disabled = false;
}
/**
 * @param {string} corsProxy
 * @param {string} clientId 
 * @param {string} clientSecret 
 * @return {Promise<string>}
 * @async
 */
async function generateAccessToken(corsProxy, clientId, clientSecret) {
    const accessTokenEndpoint = `https://api.tailscale.com/api/v2/oauth/token`;
    const accessTokenProxyUrl = `${corsProxy}?url=${encodeURIComponent(accessTokenEndpoint)}`;

    // Step 1: OAuth 토큰 요청
    const tokenResponse = await fetch(accessTokenProxyUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
            // auth_keys를 만들기 위한 스코프와 태그를 명시
            scope: 'auth_keys',
            //tags: 'auth_keys'
        })
    });

    if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        throw new Error(`액세스 토큰 오류: ${tokenResponse.status} - ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    return accessToken
}

/**
 * @async
 * @param {string} corsProxy
 * @param {string} token 
 * @param {string} tailnet
 * @param {boolean} [ephemeral=true]
 * @returns {Promise<string>}
 */
async function generateAuthKey(corsProxy, token, tailnet, ephemeral = true) {
    const apiEndpoint = `https://api.tailscale.com/api/v2/tailnet/${tailnet}/keys`;
    const proxyUrl = `${corsProxy}?url=${encodeURIComponent(apiEndpoint)}`;
    const authHeader = `Bearer ${token}`;
    const body = {
        capabilities: {
            devices: {
                create: {
                    reusable: false,
                    ephemeral: ephemeral,
                    tags: ["tag:ephemeral"],
                },
            },
        },
        expirySeconds: 10 * 60 // 10 min
    };
    const response = await fetch(proxyUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API 오류: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.key;
}

document.addEventListener('DOMContentLoaded', getParamFromQuerystring);