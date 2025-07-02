import { ICommunity } from "../models/Community";
import { ImageFormData } from "../components/ImageUploadForm";
import { IImage } from "@/models/Image";
import { IEvent } from "@/models/Event";

// Define pagination response interface
export interface PaginationResponse<T> {
  communities: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export type CommunityFormData = Omit<ICommunity, "_id">;
export type EventFormData = Omit<IEvent, "_id">;

type FetchOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: any;
  headers?: Record<string, string>;
};

class ApiClient {
  private async fetch<T>(
    endpoint: string,
    options: FetchOptions = {}
  ): Promise<T> {
    const { method = "GET", body, headers = {} } = options;

    const defaultHeaders = {
      "Content-Type": "application/json",
      ...headers,
    };

    const response = await fetch(`/api${endpoint}`, {
      method,
      headers: defaultHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return response.json();
  }

  async getcommunities(page: number = 1, limit: number = 30) {
    // limit defaults to 30 per page to show more communities
    return this.fetch<PaginationResponse<ICommunity>>(
      `/community?page=${page}&limit=${limit}`
    );
  }

  async getcommunity(slug: string) {
    return this.fetch<ICommunity>(`/community/${slug}`);
  }

  async createCommunity(CommunityData: CommunityFormData) {
    return this.fetch<ICommunity>("/community", {
      method: "POST",
      body: CommunityData,
    });
  }

  async post<T>(endpoint: string, body: any): Promise<T> {
    return this.fetch<T>(endpoint, {
      method: "POST",
      body: body,
    });
  }

  async getImages(id: string) {
    return this.fetch<IImage[]>(`/image/${id}`);
  }
  async createImage(imageData: ImageFormData) {
    return this.fetch<IImage>("/image", {
      method: "POST",
      body: imageData,
    });
  }

  // Event API methods
  async getEvents(communityId: string, startDate?: string, endDate?: string) {
    let endpoint = `/community/events?communityId=${communityId}`;
    if (startDate && endDate) {
      endpoint += `&start=${startDate}&end=${endDate}`;
    }
    return this.fetch<IEvent[]>(endpoint);
  }

  async getEvent(id: string) {
    return this.fetch<IEvent>(`/community/events/${id}`);
  }

  async createEvent(eventData: EventFormData) {
    return this.fetch<IEvent>("/community/events", {
      method: "POST",
      body: eventData,
    });
  }

  async updateEvent(id: string, eventData: Partial<EventFormData>) {
    return this.fetch<IEvent>(`/community/events/${id}`, {
      method: "PUT",
      body: eventData,
    });
  }

  async deleteEvent(id: string) {
    return this.fetch<{ message: string }>(`/community/events/${id}`, {
      method: "DELETE",
    });
  }

  // Community payment methods
  async completeCommunityPayment(communityId: string, paymentData: any) {
    return this.fetch<{ success: boolean }>(`/payments/community/payment-complete`, {
      method: "POST",
      body: {
        ...paymentData,
        communityId
      },
    });
  }

  async activateCommunityTrial(communityId: string, userId: string) {
    return this.fetch<{ success: boolean }>(`/payments/community/activate-trial`, {
      method: "POST",
      body: { userId, communityId },
    });
  }
}

export const apiClient = new ApiClient();
