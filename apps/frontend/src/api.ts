import { createApi, fetchBaseQuery, type BaseQueryFn, type FetchArgs, type FetchBaseQueryError } from '@reduxjs/toolkit/query/react';
import type { FortuneDto, FortunePageDto, MeDto, ProfileUpdateInput, TodayDto } from '@third-eye/shared';

// Absolute base so RTK's `new Request(url)` also works under jsdom.
const raw = fetchBaseQuery({ baseUrl: `${globalThis.location?.origin ?? ''}/api`, credentials: 'same-origin' });

/** Unwraps `{ data }` and bounces to login on 401. */
const baseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (args, api, extra) => {
  const result = await raw(args, api, extra);
  if (result.error?.status === 401) globalThis.location.assign('/api/auth/login');
  if (result.data && typeof result.data === 'object' && 'data' in result.data) {
    return { ...result, data: (result.data as { data: unknown }).data };
  }
  return result;
};

export function apiErrorCode(err: unknown): string | null {
  const data = (err as { data?: { error?: { code?: unknown } } } | undefined)?.data;
  return typeof data?.error?.code === 'string' ? data.error.code : null;
}

export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['Me', 'Fortune', 'History'],
  endpoints: (b) => ({
    getMe: b.query<MeDto, void>({ query: () => '/me', providesTags: ['Me'] }),
    updateMe: b.mutation<MeDto, ProfileUpdateInput>({
      query: (body) => ({ url: '/me', method: 'PATCH', body }),
      invalidatesTags: ['Me'],
    }),
    logout: b.mutation<{ endSessionUrl: string | null }, void>({ query: () => ({ url: '/auth/logout', method: 'POST' }) }),
    openToday: b.mutation<TodayDto, void>({
      query: () => ({ url: '/fortunes/today', method: 'POST' }),
      invalidatesTags: (r) => (r ? [{ type: 'Fortune', id: r.fortune.id }, 'History'] : []),
    }),
    getFortune: b.query<FortuneDto, string>({
      query: (id) => `/fortunes/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Fortune', id }],
    }),
    getHistory: b.query<FortunePageDto, string | undefined>({
      query: (cursor) => `/fortunes${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
      providesTags: ['History'],
    }),
  }),
});

export const {
  useGetMeQuery, useUpdateMeMutation, useLogoutMutation, useOpenTodayMutation, useGetFortuneQuery, useGetHistoryQuery,
} = api;
