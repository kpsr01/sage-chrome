import llmService from './api/llmService.js';

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
        this.transcript = null;
        this.metadata = null;
        this.lastUpdate = Date.now();
        this.throttleDelay = 500;
        this.init();
        this.setupUrlChangeListener();
        this.setupThemeObserver();
    }

    init() {
        if (this.site.includes('youtube.com')) {
            this.setupObserver();
            const sidebar = document.querySelector('#secondary.style-scope.ytd-watch-flexy');
            if (sidebar) {
                this.insertInSidebar();
                this.updateTranscript();
            }
        }
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

        if (transcriptResult && !transcriptResult.error) {
            this.transcript = transcriptResult.data;
        }
        
        if (metadata) {
            this.metadata = metadata;
        }

        const messagesDiv = document.querySelector('#chatMessages');
        if (messagesDiv) {
            messagesDiv.innerHTML = '';
            const welcomeMsg = document.createElement('p');
            welcomeMsg.style.color = '#666';
            welcomeMsg.style.fontSize = '16px';
            welcomeMsg.textContent = 'Welcome! Ask me anything about this video...';
            messagesDiv.appendChild(welcomeMsg);
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

    createChatInterface() {
        const template = `
            <div class="extension-header">
                <h2 class="extension-title">Sage</h2>
                <button class="collapse-button" title="Collapse/Expand">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/>
                    </svg>
                </button>
            </div>
            <div class="chat-messages" id="chatMessages">
                <p style="color: #666; font-size: 16px;">Welcome! Ask me anything about this video...</p>
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

        const sendMessage = async () => {
            const message = input.value.trim();
            if (message) {
                // Display user message
                const userMessageElement = document.createElement('div');
                userMessageElement.style.marginBottom = '12px';
                userMessageElement.style.fontSize = '16px';
                userMessageElement.innerHTML = `<strong>You:</strong> ${message}`;
                messagesDiv.appendChild(userMessageElement);
                input.value = '';

                // Show loading indicator
                const loadingElement = document.createElement('div');
                loadingElement.innerHTML = '<strong>Sage:</strong> Thinking...';
                messagesDiv.appendChild(loadingElement);

                try {
                    // Get current video context
                    const videoData = {
                        transcript: this.transcript?.data || '',
                        metadata: await this.getVideoMetadata()
                    };

                    // Call the deployed API endpoint
                    const response = await fetch('https://sage-of93.vercel.app/api', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            query: message,
                            videoData: videoData
                        })
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.details || response.statusText);
                    }

                    const data = await response.json();
                    
                    // Remove loading indicator
                    messagesDiv.removeChild(loadingElement);
                    
                    // Display AI response
                    const aiMessageElement = document.createElement('div');
                    aiMessageElement.style.marginBottom = '12px';
                    aiMessageElement.style.fontSize = '16px';
                    aiMessageElement.innerHTML = `<strong>Sage:</strong> ${data.answer}`;
                    messagesDiv.appendChild(aiMessageElement);
                    
                    // Scroll to bottom
                    messagesDiv.scrollTop = messagesDiv.scrollHeight;
                } catch (error) {
                    console.error('Error:', error);
                    // Remove loading indicator
                    messagesDiv.removeChild(loadingElement);
                    
                    // Display error message
                    const errorElement = document.createElement('div');
                    errorElement.style.marginBottom = '12px';
                    errorElement.style.fontSize = '16px';
                    errorElement.style.color = '#ff0000';
                    errorElement.innerHTML = `<strong>Sage:</strong> Server error, please try again later`;
                    messagesDiv.appendChild(errorElement);
                }
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

// Example usage
async function handleVideoLoad(videoData) {
    const summary = await llmService.processVideoContent(videoData);
    // Store or display the summary
}

async function handleUserQuery(query, videoContext) {
    const answer = await llmService.answerQuery(query, videoContext);
    // Display the answer
}

new YouTubeChatAssistant();