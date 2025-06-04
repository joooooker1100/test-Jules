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
    httpService = module.get<HttpService>(HttpService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('fetchChatGptResponse', () => {
    const prompt = 'Test prompt';
    const apiKey = 'test-api-key';
    const apiUrl = 'https://api.example.com/chat';
    const mockApiResponse = { choices: [{ text: 'Test response' }] };

    // Helper to set up default config mocks for most tests
    const setupDefaultConfigMocks = () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'CHATGPT_API_KEY') return apiKey;
        if (key === 'CHATGPT_API_URL') return apiUrl;
        return null;
      });
    };

    it('should return data on successful API call', async () => {
      setupDefaultConfigMocks();
      mockHttpService.post.mockReturnValue(of({ data: mockApiResponse, status: 200, statusText: 'OK', headers: {}, config: {} } as AxiosResponse));

      const result = await service.fetchChatGptResponse(prompt);
      result.subscribe(data => {
        expect(data).toEqual(mockApiResponse);
        expect(mockHttpService.post).toHaveBeenCalledWith(apiUrl,
          { model: 'text-davinci-003', prompt, max_tokens: 150 },
          { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } }
        );
      });
    });

    it('should throw InternalServerErrorException if API key is missing', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'CHATGPT_API_KEY') return null;
        if (key === 'CHATGPT_API_URL') return apiUrl;
        return null;
      });
      await expect(service.fetchChatGptResponse(prompt)).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException if API URL is missing', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'CHATGPT_API_KEY') return apiKey;
        if (key === 'CHATGPT_API_URL') return null;
        return null;
      });
      await expect(service.fetchChatGptResponse(prompt)).rejects.toThrow(InternalServerErrorException);
    });


    it('should throw HttpException on API error (e.g., 4xx)', async () => {
      setupDefaultConfigMocks();
      const errorResponse = { message: 'Unauthorized', statusCode: 401 };
      const axiosError = {
        isAxiosError: true,
        response: { data: errorResponse, status: 401, statusText: 'Unauthorized', headers: {}, config: {} },
        message: 'Request failed with status code 401',
      } as AxiosError;
      mockHttpService.post.mockReturnValue(throwError(() => axiosError));

      try {
        await service.fetchChatGptResponse(prompt);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(401);
        expect(error.getResponse()).toEqual(errorResponse);
      }
    });

    it('should throw BadGatewayException if no response received from API', async () => {
      setupDefaultConfigMocks();
      const axiosError = {
        isAxiosError: true,
        request: {}, // Simulates request made but no response
        message: 'Network Error',
      } as AxiosError;
      mockHttpService.post.mockReturnValue(throwError(() => axiosError));

      try {
        await service.fetchChatGptResponse(prompt);
      } catch (error) {
        expect(error).toBeInstanceOf(BadGatewayException);
      }
    });

    it('should throw InternalServerErrorException for other errors', async () => {
      setupDefaultConfigMocks();
      const error = new Error('Some other error');
      mockHttpService.post.mockReturnValue(throwError(() => error));

      try {
        await service.fetchChatGptResponse(prompt);
      } catch (e) {
         expect(e).toBeInstanceOf(InternalServerErrorException);
         expect(e.message).toBe('Error setting up ChatGPT API request');
      }
    });
  });
});
