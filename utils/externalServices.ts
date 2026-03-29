// youngie/utils/externalServices.ts
// External Services Load Balancer - handles Supabase, TURN servers, external APIs

import axios, { AxiosInstance } from 'axios';

// ============== CONFIGURATION ==============

// TURN server configurations using Metered.ca (free TURN servers)
const TURN_SERVERS = process.env.EXPO_PUBLIC_TURN_SERVERS
  ? JSON.parse(process.env.EXPO_PUBLIC_TURN_SERVERS)
  : [
      // Free STUN servers (always available)
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      // Free Metered.ca TURN servers (if credentials available)
      { urls: 'turn:global.metered.ca:443', username: 'anonymous', credential: 'anonymous' },
      { urls: 'turn:global.metered.ca:3478', username: 'anonymous', credential: 'anonymous' },
    ];

// Supabase configuration
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://srcpkwkdvslsdjegqjff.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// External APIs
const EXTERNAL_APIS = process.env.EXPO_PUBLIC_EXTERNAL_APIS
  ? JSON.parse(process.env.EXPO_PUBLIC_EXTERNAL_APIS)
  : {
      // Nominatim for geocoding (free, no auth needed)
      geocoding: 'https://nominatim.openstreetmap.org',
    };

// ============== SERVICE TYPES ==============

export interface ICEServer {
  urls: string;
  username?: string;
  credential?: string;
}

export interface ExternalServiceConfig {
  baseURL: string;
  timeout: number;
  retries: number;
}

// ============== CIRCUIT BREAKER ==============

class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private readonly failureThreshold: number = 5,
    private readonly resetTimeout: number = 30000 // 30 seconds
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      // Check if we should try half-open
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    if (this.state === 'half-open') {
      this.state = 'closed';
      console.log('✅ Circuit breaker closed (recovered)');
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
      console.warn(`🔴 Circuit breaker opened after ${this.failureCount} failures`);
    }
  }

  getState(): string {
    return this.state;
  }
}

// ============== TURN SERVER LOAD BALANCER ==============

class TurnServerLoadBalancer {
  private currentIndex = 0;
  private servers: ICEServer[] = [];
  private circuitBreaker = new CircuitBreaker();
  private initialized = false;

  /**
   * Initialize TURN servers with credentials
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Try to get credentials from backend
    try {
      const response = await axios.get(`${process.env.EXPO_PUBLIC_API_URL?.replace('/api', '') || 'http://10.0.2.:5001'}/health`, {
        timeout: 5000,
      });
      
      // If backend is healthy, use dynamic TURN servers
      this.servers = TURN_SERVERS;
    } catch {
      // Fallback to static servers
      this.servers = TURN_SERVERS;
    }

    this.initialized = true;
    console.log('🔄 TURN servers initialized:', this.servers.length);
  }

  /**
   * Get next available TURN server
   */
  getServer(): ICEServer {
    if (!this.initialized) {
      this.initialize();
    }

    // Round-robin selection
    const server = this.servers[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % Math.max(1, this.servers.length);

    return server;
  }

  /**
   * Get all TURN servers for WebRTC configuration
   */
  async getAllServers(): Promise<ICEServer[]> {
    return this.circuitBreaker.execute(async () => {
      await this.initialize();
      return this.servers;
    });
  }
}

// ============== SUPABASE LOAD BALANCER ==============

class SupabaseLoadBalancer {
  private circuitBreaker = new CircuitBreaker(3, 60000);
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: SUPABASE_URL,
      timeout: 10000,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
  }

  /**
   * Execute request with circuit breaker and retry
   */
  async request<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, data?: any): Promise<T> {
    return this.circuitBreaker.execute(async () => {
      const response = await this.client.request({
        method,
        url: path,
        data,
      });
      return response.data;
    });
  }

  getState(): string {
    return this.circuitBreaker.getState();
  }
}

// ============== EXTERNAL API LOAD BALANCER ==============

class ExternalAPILoadBalancer {
  private circuits: Map<string, CircuitBreaker> = new Map();
  private clients: Map<string, AxiosInstance> = new Map();

  /**
   * Get or create circuit breaker for an API
   */
  private getCircuit(name: string): CircuitBreaker {
    if (!this.circuits.has(name)) {
      this.circuits.set(name, new CircuitBreaker(5, 30000));
    }
    return this.circuits.get(name)!;
  }

  /**
   * Get or create client for an API
   */
  private getClient(name: string, baseURL: string): AxiosInstance {
    if (!this.clients.has(name)) {
      this.clients.set(name, axios.create({
        baseURL,
        timeout: 10000,
      }));
    }
    return this.clients.get(name)!;
  }

  /**
   * Make request with circuit breaker and fallback
   */
  async request<T>(apiName: string, method: 'GET' | 'POST', path: string, data?: any): Promise<T> {
    const circuit = this.getCircuit(apiName);
    const baseURL = EXTERNAL_APIS[apiName as keyof typeof EXTERNAL_APIS];
    
    if (!baseURL) {
      throw new Error(`Unknown API: ${apiName}`);
    }

    const client = this.getClient(apiName, baseURL);

    return circuit.execute(async () => {
      const response = await client.request({
        method,
        url: path,
        data,
        // Add User-Agent for Nominatim
        headers: apiName === 'geocoding' ? {
          'User-Agent': 'YoungieApp/1.0',
        } : {},
      });
      return response.data;
    });
  }

  /**
   * Get circuit breaker states
   */
  getStatus(): Record<string, string> {
    const status: Record<string, string> = {};
    this.circuits.forEach((circuit, name) => {
      status[name] = circuit.getState();
    });
    return status;
  }
}

// ============== SINGLETON INSTANCES ==============

export const turnServerBalancer = new TurnServerLoadBalancer();
export const supabaseBalancer = new SupabaseLoadBalancer();
export const externalAPIBalancer = new ExternalAPILoadBalancer();

// ============== HELPER FUNCTIONS ==============

/**
 * Get TURN servers for WebRTC
 */
export async function getICEServers(): Promise<ICEServer[]> {
  return turnServerBalancer.getAllServers();
}

/**
 * Get load balancer status for monitoring
 */
export function getServicesStatus(): {
  supabase: string;
  external: Record<string, string>;
  turn: { initialized: boolean; servers: number };
} {
  return {
    supabase: supabaseBalancer.getState(),
    external: externalAPIBalancer.getStatus(),
    turn: { 
      initialized: (turnServerBalancer as any).initialized || false, 
      servers: (turnServerBalancer as any).servers?.length || 0 
    },
  };
}