const site = window.location.hostname


const Add_Custom_Style = css => document.head.appendChild(document.createElement("style")).innerHTML = css

function Create_Custom_Element(tag, attr_tag, attr_name, value) {
    const custom_element = document.createElement(tag)
    custom_element.setAttribute(attr_tag, attr_name)
    custom_element.innerHTML = value
    document.body.append(custom_element)
}

if (site.includes("youtube.com")) {

    Add_Custom_Style(`
        .yt-extension-sidebar {
            background-color: #ffffff;
            padding: 16px;
            margin: 12px 0;
            border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.12);
            font-family: "Roboto", sans-serif;
            color: #030303;
            height: 400px;
            display: flex;
            flex-direction: column;
        }

        .chat-messages {
            flex-grow: 1;
            overflow-y: auto;
            margin-bottom: 12px;
            padding: 8px;
            background: #f8f8f8;
            border-radius: 8px;
        }

        .chat-input-container {
            display: flex;
            gap: 8px;
        }

        .chat-input {
            flex-grow: 1;
            padding: 8px 12px;
            border: 1px solid #e0e0e0;
            border-radius: 20px;
            font-size: 14px;
            outline: none;
        }

        .chat-input:focus {
            border-color: #065fd4;
        }

        .send-button {
            background: #065fd4;
            color: white;
            border: none;
            border-radius: 20px;
            padding: 8px 16px;
            cursor: pointer;
            font-size: 14px;
        }

        .send-button:hover {
            background: #0356c7;
        }
    `)
}

class YouTubeChatAssistant {
    constructor() {
        this.site = window.location.hostname;
        this.lastVideoId = null;
        this.isDarkMode = document.documentElement.hasAttribute('dark') || 
                         document.querySelector('ytd-app[dark]') !== null || 
                         document.querySelector('html[dark]') !== null;
        this.init();
        this.setupUrlChangeListener();
        this.setupThemeObserver();
    }

    setupUrlChangeListener() {
        let lastUrl = location.href;
        const config = { attributes: false, childList: true, subtree: true };

        const observer = new MutationObserver(() => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                setTimeout(() => {
                    this.updateTranscript();
                }, 1000);
            }
        });

        observer.observe(document.body, config);
    }

    async updateTranscript() {
        await new Promise(resolve => setTimeout(resolve, 1500));

        const [transcriptResult, metadata] = await Promise.all([
            this.fetchTranscript(),
            this.getVideoMetadata()
        ]);

        const messagesDiv = document.querySelector('#chatMessages');
        if (messagesDiv) {
            messagesDiv.innerHTML = '';
            
            const metadataDiv = document.createElement('div');
            metadataDiv.className = 'video-metadata';
metadataDiv.innerHTML = `
<div class="metadata-title">${metadata.title}</div>
<div class="metadata-channel">${metadata.channel}</div>
<div class="metadata-date">Uploaded on ${metadata.uploadDate}</div>
<div class="metadata-tags">${metadata.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>
<div class="metadata-description">${metadata.description}</div>
`;
            messagesDiv.appendChild(metadataDiv);
            
            const welcomeMsg = document.createElement('p');
            welcomeMsg.style.color = '#666';
            welcomeMsg.style.fontSize = '14px';
            welcomeMsg.textContent = 'Welcome! Ask me anything about this video...';
            messagesDiv.appendChild(welcomeMsg);
            
            if (transcriptResult) {
                this.transcript = transcriptResult.data;
                this.displayTranscript(transcriptResult);
            }
        }
    }

    getVideoId() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('v');
    }

    async fetchTranscript() {
        const videoId = this.getVideoId();
        if (!videoId) return null;

        try {
            const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
            const html = await response.text();
            
            const captionsMatch = html.match(/"captionTracks":\[(.*?)\]/);
            if (!captionsMatch) {
                return { error: 'No transcript available for this video. Please try another video.' };
            }

            const captions = JSON.parse(`[${captionsMatch[1]}]`);
            
            let selectedCaptions = captions.find(caption => caption.languageCode === 'en');
            
            if (!selectedCaptions && captions.length > 0) {
                selectedCaptions = captions[0];
            }

            if (!selectedCaptions?.baseUrl) {
                return { error: 'No transcript available for this video.' };
            }

            const transcriptResponse = await fetch(selectedCaptions.baseUrl);
            const transcriptText = await transcriptResponse.text();
            
            const parser = new DOMParser();
            const doc = parser.parseFromString(transcriptText, 'text/xml');
            const textElements = doc.getElementsByTagName('text');
            
            const transcript = Array.from(textElements)
                .map(text => text.textContent.trim())
                .filter(text => text)
                .join('\n');

            return { 
                data: transcript,
                language: selectedCaptions.languageCode,
                isTranslated: selectedCaptions.kind === 'asr'
            };
        } catch (error) {
            console.error('Error fetching transcript:', error);
            return { error: 'Failed to fetch transcript. Please try again.' };
        }
    }

    displayTranscript(transcriptResult) {
        const messagesDiv = document.querySelector('#chatMessages');
        if (!messagesDiv) return;

        if (transcriptResult.error) {
            const errorElement = document.createElement('div');
            errorElement.style.marginBottom = '16px';
            errorElement.style.padding = '12px';
            errorElement.style.backgroundColor = '#fde8e8';
            errorElement.style.borderRadius = '8px';
            errorElement.style.color = '#e53e3e';
            errorElement.innerHTML = `
                <strong style="display: block; margin-bottom: 8px;">⚠️ Notice:</strong>
                <div style="font-size: 14px; line-height: 1.4;">${transcriptResult.error}</div>
            `;
            messagesDiv.appendChild(errorElement);
        } else if (transcriptResult.data) {
            const transcriptElement = document.createElement('div');
            transcriptElement.style.marginBottom = '16px';
            transcriptElement.style.padding = '8px';
            transcriptElement.style.backgroundColor = '#f0f0f0';
            transcriptElement.style.borderRadius = '8px';
            transcriptElement.innerHTML = `
                <strong style="display: block; margin-bottom: 8px;">Video Transcript ${
                    transcriptResult.language !== 'en' ? 
                    `(${transcriptResult.language.toUpperCase()})` : 
                    ''}:</strong>
                <div style="font-size: 14px; line-height: 1.4;">${transcriptResult.data}</div>
            `;
            messagesDiv.appendChild(transcriptElement);
        }

        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    async init() {
        if (this.site.includes("youtube.com")) {
            this.setupObserver();
            const transcriptResult = await this.fetchTranscript();
            if (transcriptResult) {
               // console.log('Transcript loaded:', transcriptResult);
                this.transcript = transcriptResult;
                
                const checkInterval = setInterval(() => {
                    if (document.querySelector('#chatMessages')) {
                        this.displayTranscript(transcriptResult);
                        clearInterval(checkInterval);
                    }
                }, 1000);

                setTimeout(() => clearInterval(checkInterval), 10000);
            }
        }
    }

    createChatInterface() {
        const template = `
            <div class="extension-header">
                <h2 class="extension-title">YT AI Assistant</h2>
                <button class="collapse-button" title="Collapse/Expand">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/>
                    </svg>
                </button>
            </div>
            <div class="chat-messages" id="chatMessages">
                <p style="color: #666; font-size: 14px;">Welcome! Ask me anything about this video...</p>
            </div>
            <div class="chat-input-container">
                <input type="text" class="chat-input" placeholder="Type your message..." id="chatInput">
                <button class="send-button">Send</button>
            </div>
        `;

        const extensionDiv = document.createElement('div');
        extensionDiv.className = 'yt-extension-sidebar';
        if (this.isDarkMode) {
            extensionDiv.classList.add('dark-mode');
        }
        extensionDiv.innerHTML = template;
        return extensionDiv;
    }

    setupEventListeners(container) {
        const input = container.querySelector('#chatInput');
        const sendButton = container.querySelector('.send-button');
        const messagesDiv = container.querySelector('#chatMessages');

        const sendMessage = () => {
            const message = input.value.trim();
            if (message) {
                const messageElement = document.createElement('div');
                messageElement.style.marginBottom = '8px';
                messageElement.innerHTML = `<strong>You:</strong> ${message}`;
                messagesDiv.appendChild(messageElement);
                input.value = '';
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
            }
        };

        sendButton.addEventListener('click', sendMessage);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });

        const collapseButton = container.querySelector('.collapse-button');
        collapseButton.addEventListener('click', () => {
            container.classList.toggle('collapsed');
            collapseButton.classList.toggle('collapsed');
            
            const isCollapsed = container.classList.contains('collapsed');
            localStorage.setItem('ytChatCollapsed', isCollapsed);
        });

        const wasCollapsed = localStorage.getItem('ytChatCollapsed') === 'true';
        if (wasCollapsed) {
            container.classList.add('collapsed');
            collapseButton.classList.add('collapsed');
        }
    }

    insertInSidebar() {
        const sidebar = document.querySelector('#secondary.style-scope.ytd-watch-flexy');
        if (sidebar) {
            const chatInterface = this.createChatInterface();
            sidebar.insertBefore(chatInterface, sidebar.firstChild);
            this.setupEventListeners(chatInterface);
        }
    }

    setupObserver() {
        const observer = new MutationObserver((mutations, obs) => {
            const sidebar = document.querySelector('#secondary.style-scope.ytd-watch-flexy');
            if (sidebar) {
                this.insertInSidebar();
                this.updateTranscript();
                obs.disconnect();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        setTimeout(() => observer.disconnect(), 10000);
    }

    setupThemeObserver() {
        const getYouTubeTheme = () => {
            return document.documentElement.hasAttribute('dark') || 
                   document.querySelector('ytd-app[dark]') !== null || 
                   document.querySelector('html[dark]') !== null;
        };

        const observer = new MutationObserver(() => {
            const now = Date.now();
            if (now - this.lastUpdate >= this.throttleDelay) {
                this.lastUpdate = now;
                this.isDarkMode = getYouTubeTheme();
                const sidebar = document.querySelector('.yt-extension-sidebar');
                if (sidebar) {
                    if (this.isDarkMode) {
                        sidebar.classList.add('dark-mode');
                    } else {
                        sidebar.classList.remove('dark-mode');
                    }
                }
            }
        });

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['dark'],
            subtree: true
        });
    }

    async getVideoMetadata() {
        try {
            const response = await fetch(window.location.href);
            const html = await response.text();
            
            const titleMatch = html.match(/"title":\s*"([^"]*?)"/);
            const channelMatch = html.match(/"ownerChannelName":\s*"([^"]*?)"/);
            const uploadDateMatch = html.match(/"uploadDate":\s*"([^"]*?)"/);
            
            const tagsMatch = html.match(/"keywords":\[([^\]]*)\]/);
            
            const descriptionMatch = html.match(/"description":{"simpleText":"(.*?)"}}/);
            const altDescriptionMatch = html.match(/"shortDescription":"(.*?)"/);
            
            let tags = [];
            if (tagsMatch?.[1]) {
                tags = tagsMatch[1]
                    .split(',')
                    .map(tag => JSON.parse(tag.trim()))
                    .filter(tag => tag);
            }
            
            let description = '';
            if (descriptionMatch?.[1] || altDescriptionMatch?.[1]) {
                description = (descriptionMatch?.[1] || altDescriptionMatch?.[1])
                    .replace(/\\n/g, '\n')
                    .replace(/\\"/g, '"')
                    .replace(/\\\\/g, '\\');

                const familySafeIndex = description.indexOf('isFamilySafe');
                if (familySafeIndex !== -1) {
                    description = description.substring(0, familySafeIndex).trim();
                }
            }
            
            return {
                title: titleMatch?.[1] || 'Title not found',
                channel: channelMatch?.[1] || 'Channel not found',
                uploadDate: uploadDateMatch ? new Date(uploadDateMatch[1]).toLocaleDateString() : 'Date not found',
                description: description || 'Description not found',
                tags: tags.length > 0 ? tags : ['No tags found']
            };
        } catch (error) {
            console.error('Error fetching video metadata:', error);
            return {
                title: 'Error fetching title',
                channel: 'Error fetching channel',
                uploadDate: 'Error fetching date',
                description: 'Error fetching description',
                tags: ['Error fetching tags']
            };
        }
    }
}

new YouTubeChatAssistant();