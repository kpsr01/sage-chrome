class LLMService {
  constructor() {
      this.apiKey = process.env.OPENROUTER_API_KEY;
      this.siteUrl = process.env.SITE_URL;
      this.siteName = process.env.SITE_NAME;
      
      if (!this.apiKey) {
          throw new Error('OpenRouter API key not found in environment variables');
      }
  }

  async processVideoData(videoData) {
      try {
          // Extract transcript using the existing YouTube data extraction
          const transcript = await this.getVideoTranscript();
          const metadata = await this.getVideoMetadata();

          return {
              transcript: transcript,
              metadata: metadata
          };
      } catch (error) {
          console.error('Error processing video data:', error);
          throw error;
      }
  }

  async getVideoTranscript() {
      try {
          const response = await fetch(window.location.href);
          const html = await response.text();
          
          const captionsMatch = html.match(/"captionTracks":\[(.*?)\]/);
          if (!captionsMatch) {
              throw new Error('No transcript available');
          }

          const captions = JSON.parse(`[${captionsMatch[1]}]`);
          let selectedCaptions = captions.find(caption => caption.languageCode === 'en') || captions[0];

          if (!selectedCaptions?.baseUrl) {
              throw new Error('No transcript URL found');
          }

          const transcriptResponse = await fetch(selectedCaptions.baseUrl);
          const transcriptText = await transcriptResponse.text();
          
          const parser = new DOMParser();
          const doc = parser.parseFromString(transcriptText, 'text/xml');
          const textElements = doc.getElementsByTagName('text');
          
          return Array.from(textElements)
              .map(text => text.textContent.trim())
              .filter(text => text)
              .join(' ');
      } catch (error) {
          console.error('Error fetching transcript:', error);
          return '';
      }
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
          
          return {
              title: titleMatch?.[1] || 'Title not found',
              channel: channelMatch?.[1] || 'Channel not found',
              uploadDate: uploadDateMatch ? new Date(uploadDateMatch[1]).toLocaleDateString() : 'Date not found',
              description: (descriptionMatch?.[1] || altDescriptionMatch?.[1] || 'Description not found')
                  .replace(/\\n/g, '\n')
                  .replace(/\\"/g, '"'),
              tags: tagsMatch ? JSON.parse(`[${tagsMatch[1]}]`) : ['No tags found']
          };
      } catch (error) {
          console.error('Error fetching metadata:', error);
          return {
              title: 'Error fetching title',
              channel: 'Error fetching channel',
              uploadDate: 'Error fetching date',
              description: 'Error fetching description',
              tags: ['Error fetching tags']
          };
      }
  }

  async answerQuery(query, videoData) {
      try {
          const formattedContext = `
              Video Title: ${videoData.metadata.title}
              Channel Name: ${videoData.metadata.channel}
              Upload Date: ${videoData.metadata.uploadDate}
              Description: ${videoData.metadata.description}
              Tags: ${videoData.metadata.tags.join(', ')}
              
              Complete Transcript:
              ${videoData.transcript}
          `;

          const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
              method: "POST",
              headers: {
                  "Authorization": `Bearer ${this.apiKey}`,
                  "HTTP-Referer": this.siteUrl,
                  "X-Title": this.siteName,
                  "Content-Type": "application/json"
              },
              body: JSON.stringify({
                  "model": "meta-llama/llama-3.3-70b-instruct:free",
                  "messages": [
                      {
                          "role": "system",
                          "content": "You are a helpful AI assistant that answers questions about YouTube videos based on their transcripts and metadata. Analyze the provided transcript and metadata to give concise, accurate answers that are directly related to the video content. If the information isn't in the video content, acknowledge that. The date is in DD/MM/YYYY format. Dont mention about the metadata or transcript to the user. The user should think you can see the video, so communicate just about the video. Use the following context to answer the user's question:"
                      },
                      {
                          "role": "user",
                          "content": `${formattedContext}\n\nUser Question: ${query}`
                      }
                  ],
                  "temperature": 0.7,
                  "max_tokens": 500
              })
          });

          if (!response.ok) {
              throw new Error(`API request failed: ${response.statusText}`);
          }

          const data = await response.json();
          return data.choices[0].message.content;
          
      } catch (error) {
          console.error('Error in answerQuery:', error);
          return `Sorry, I encountered an error: ${error.message}. Please try again.`;
      }
  }
}

module.exports = { LLMService };