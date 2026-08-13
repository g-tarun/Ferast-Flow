/// <reference types="expo/types" />

declare const __DEV__: boolean

declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_API_URL?: string
  }
}
