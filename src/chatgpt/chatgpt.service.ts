import { Injectable, HttpException, BadGatewayException, InternalServerErrorException, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class ChatgptService {
  private readonly logger = new Logger(ChatgptService.name);
  private readonly defaultModel = 'gpt-3.5-turbo'; // Standardize model

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async fetchChatGptResponse(prompt: string): Promise<string> {
    const apiKey = this.configService.get<string>('CHATGPT_API_KEY');
    const apiUrl = this.configService.get<string>('CHATGPT_API_URL');

    if (!apiKey || apiKey === 'your_api_key_here') {
      this.logger.error('ChatGPT API Key is not configured or is using the placeholder value.');
      throw new InternalServerErrorException('ChatGPT API Key is not configured. Please set it in the .env file.');
    }
    if (!apiUrl) {
      this.logger.error('ChatGPT API URL is not configured.');
      throw new InternalServerErrorException('ChatGPT API URL is not configured.');
    }

    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    // Payload for chat models (e.g., gpt-3.5-turbo)
    const data = {
      model: this.defaultModel,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150, // Optional: adjust as needed
    };

    try {
      const responseObservable = this.httpService.post(apiUrl, data, { headers });
      const axiosResponse = await lastValueFrom(responseObservable);

      if (axiosResponse.data && axiosResponse.data.choices && axiosResponse.data.choices.length > 0) {
        const choice = axiosResponse.data.choices[0];
        if (choice.message && choice.message.content) {
          return choice.message.content.trim();
        } else if (choice.text) { // Fallback for older model structures if any confusion remains
          this.logger.warn(`Received response in older 'text' format with model ${data.model}. Consider aligning model and response parsing.`);
          return choice.text.trim();
        }
        this.logger.warn('Unexpected response structure in choices[0]:', choice);
        throw new InternalServerErrorException('Could not parse ChatGPT response content.');
      } else {
        this.logger.warn('Empty or unexpected response structure from ChatGPT API:', axiosResponse.data);
        throw new InternalServerErrorException('No valid response content received from ChatGPT API.');
      }
    } catch (error) {
      this.logger.error(`Error calling ChatGPT API: ${error.message}`, error.stack);
      if (error instanceof AxiosError) {
        if (error.response) {
          const { status, data: errorData } = error.response;
          let apiErrorMessage = 'Error communicating with ChatGPT API.';
          if (errorData && errorData.error && errorData.error.message) {
            apiErrorMessage = errorData.error.message;
          } else if (typeof errorData === 'string' && errorData.length > 0) {
            apiErrorMessage = errorData;
          }
          this.logger.error(`ChatGPT API Error: Status ${status}, Data: ${JSON.stringify(errorData)}`);
          throw new HttpException(apiErrorMessage, status);
        } else if (error.request) {
          this.logger.error('No response received from ChatGPT API');
          throw new BadGatewayException('No response received from ChatGPT API. Check network or API status.');
        }
      }
      // Fallback for non-Axios errors or Axios errors without response/request
      throw new InternalServerErrorException(error.message || 'An unexpected error occurred while contacting ChatGPT API.');
    }
  }
}
