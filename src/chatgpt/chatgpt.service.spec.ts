import { Test, TestingModule } from '@nestjs/testing';
import { ChatgptService } from './chatgpt.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { BadGatewayException, HttpException, InternalServerErrorException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AxiosError, AxiosResponse } from 'axios';

// Mock HttpService
const mockHttpService = {
  post: jest.fn(),
};

// Mock ConfigService
const mockConfigService = {
  get: jest.fn(),
};

describe('ChatgptService', () => {
  let service: ChatgptService;
  // httpService and configService are not strictly needed in the test suite scope
  // if all interactions are via the 'service' instance and mocks are configured globally per test.
  // However, keeping them for potential direct assertions if necessary.
  let httpService: HttpService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatgptService,
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<ChatgptService>(ChatgptService);
    httpService = module.get<HttpService>(HttpService); // Get the mocked instance
    configService = module.get<ConfigService>(ConfigService); // Get the mocked instance
  });

  afterEach(() => {
    jest.clearAllMocks(); // Clear mocks after each test
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('fetchChatGptResponse', () => {
    const prompt = 'Test prompt';
    const apiKey = 'test-api-key';
    const apiUrl = 'https://api.openai.com/v1/chat/completions'; // Updated
    const defaultModel = 'gpt-3.5-turbo'; // As in service

    // Helper to set up default config mocks for most tests
    const setupDefaultConfigMocks = () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'CHATGPT_API_KEY') return apiKey;
        if (key === 'CHATGPT_API_URL') return apiUrl;
        return null;
      });
    };

    it('should return extracted message content on successful API call', async () => {
      setupDefaultConfigMocks();
      const mockApiResponseData = { choices: [{ message: { content: ' Extracted AI response ' } }] };
      // HttpService.post returns an Observable, so mock it with 'of()'
      mockHttpService.post.mockReturnValue(of({ data: mockApiResponseData, status: 200, statusText: 'OK', headers: {}, config: {} } as AxiosResponse));

      const result = await service.fetchChatGptResponse(prompt);

      expect(result).toEqual('Extracted AI response');
      expect(mockHttpService.post).toHaveBeenCalledWith(
        apiUrl,
        { model: defaultModel, messages: [{ role: 'user', content: prompt }], max_tokens: 150 },
        { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } }
      );
    });

    it('should throw InternalServerErrorException if API key is null', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'CHATGPT_API_KEY') return null;
        if (key === 'CHATGPT_API_URL') return apiUrl;
        return null;
      });
      await expect(service.fetchChatGptResponse(prompt))
        .rejects.toThrow(new InternalServerErrorException('ChatGPT API Key is not configured. Please set it in the .env file.'));
    });

    it('should throw InternalServerErrorException if API key is placeholder', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'CHATGPT_API_KEY') return 'your_api_key_here';
        if (key === 'CHATGPT_API_URL') return apiUrl;
        return null;
      });
      await expect(service.fetchChatGptResponse(prompt))
        .rejects.toThrow(new InternalServerErrorException('ChatGPT API Key is not configured. Please set it in the .env file.'));
    });

    it('should throw InternalServerErrorException if API URL is missing', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'CHATGPT_API_KEY') return apiKey;
        if (key === 'CHATGPT_API_URL') return null;
        return null;
      });
      await expect(service.fetchChatGptResponse(prompt))
        .rejects.toThrow(new InternalServerErrorException('ChatGPT API URL is not configured.'));
    });

    it('should throw HttpException with details from API error (e.g., 4xx/5xx)', async () => {
      setupDefaultConfigMocks();
      const errorData = { error: { message: 'Invalid API key' } };
      // Create a more realistic AxiosError instance
      const axiosError = new AxiosError(
        'Request failed with status code 401', // message
        'ERR_BAD_REQUEST', // code
        undefined, // config
        undefined, // request
        { data: errorData, status: 401, statusText: 'Unauthorized', headers: {}, config: {} } as any // response
      );
      // HttpService.post returns an Observable, so mock error with 'throwError()'
      mockHttpService.post.mockReturnValue(throwError(() => axiosError));

      try {
        await service.fetchChatGptResponse(prompt);
      } catch (e) {
        expect(e).toBeInstanceOf(HttpException);
        expect(e.getStatus()).toBe(401);
        expect(e.message).toBe('Invalid API key');
      }
    });

    it('should throw BadGatewayException if no response received from API (network error)', async () => {
      setupDefaultConfigMocks();
       // Create a more realistic AxiosError instance for a network error
      const axiosError = new AxiosError(
        'Network Error', // message
        'ERR_NETWORK', // code
        undefined, // config
        {} // request (presence of request object is key for this type of error)
      );
      mockHttpService.post.mockReturnValue(throwError(() => axiosError));

      try {
        await service.fetchChatGptResponse(prompt);
      } catch (e) {
        expect(e).toBeInstanceOf(BadGatewayException);
        // The service throws a specific message for this case.
        expect(e.message).toBe('No response received from ChatGPT API. Check network or API status.');
      }
    });

    it('should throw InternalServerErrorException for non-Axios errors during API call setup', async () => {
      setupDefaultConfigMocks();
      const error = new Error('Some other setup error');
      // This mock simulates an error before or outside the actual HTTP request observable stream
      // This means the error happens when HttpService.post is called, not within the Observable stream.
      mockHttpService.post.mockImplementation(() => { throw error; });

      await expect(service.fetchChatGptResponse(prompt))
        .rejects.toThrow(new InternalServerErrorException('Some other setup error'));
    });

    it('should throw InternalServerErrorException if choices array is missing or empty', async () => {
      setupDefaultConfigMocks();
      mockHttpService.post.mockReturnValue(of({ data: { choices: [] }, status: 200, statusText: 'OK', headers: {}, config: {} } as AxiosResponse));
      await expect(service.fetchChatGptResponse(prompt))
        .rejects.toThrow(new InternalServerErrorException('No valid response content received from ChatGPT API.'));
    });

    it('should throw InternalServerErrorException if message content is missing', async () => {
      setupDefaultConfigMocks();
      mockHttpService.post.mockReturnValue(of({ data: { choices: [{ message: {} }] }, status: 200, statusText: 'OK', headers: {}, config: {} } as AxiosResponse));
      await expect(service.fetchChatGptResponse(prompt))
        .rejects.toThrow(new InternalServerErrorException('Could not parse ChatGPT response content.'));
    });
  });
});
