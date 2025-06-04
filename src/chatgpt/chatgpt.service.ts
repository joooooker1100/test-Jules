import { Injectable, HttpException, BadGatewayException, InternalServerErrorException, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosError, AxiosResponse } from 'axios';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

@Injectable()
export class ChatgptService {
  private readonly logger = new Logger(ChatgptService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async fetchChatGptResponse(prompt: string): Promise<Observable<AxiosResponse<any>>> {
    const apiKey = this.configService.get<string>('CHATGPT_API_KEY');
    const apiUrl = this.configService.get<string>('CHATGPT_API_URL');

    if (!apiKey || !apiUrl) {
      this.logger.error('ChatGPT API Key or URL is not configured.');
      throw new InternalServerErrorException('ChatGPT API is not configured.');
    }

    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    const data = {
      model: 'text-davinci-003', // Example model
      prompt: prompt,
      max_tokens: 150, // Example value
    };

    return this.httpService.post(apiUrl, data, { headers }).pipe(
      map(response => response.data),
      catchError((error: AxiosError) => {
        this.logger.error(`Error calling ChatGPT API: ${error.message}`, error.stack);
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          const { status, data } = error.response;
          this.logger.error(`ChatGPT API Error Response: Status ${status}, Data: ${JSON.stringify(data)}`);
          throw new HttpException(data || 'Error communicating with ChatGPT API', status);
        } else if (error.request) {
          // The request was made but no response was received
          this.logger.error('No response received from ChatGPT API');
          throw new BadGatewayException('No response received from ChatGPT API');
        } else {
          // Something happened in setting up the request that triggered an Error
          this.logger.error('Error setting up ChatGPT API request');
          throw new InternalServerErrorException('Error setting up ChatGPT API request');
        }
        return throwError(() => new InternalServerErrorException('An unexpected error occurred with ChatGPT API.'));
      })
    );
  }
}
