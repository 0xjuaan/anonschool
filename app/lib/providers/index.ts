import { GoogleOAuthProvider } from "./google-oauth";
import { AnonGroupProvider } from "../types";
import { MicrosoftOAuthProvider } from "./microsoft-oauth";
import { NSDkimProvider } from "./ns-dkim";
// import { SlackOAuthProvider } from "./slack-oauth";

export const Providers: Record<string, AnonGroupProvider> = {
  "google-oauth": GoogleOAuthProvider,
  "microsoft-oauth": MicrosoftOAuthProvider,
  "ns-dkim": NSDkimProvider,
  // "slack-oauth": SlackOAuthProvider,
};

export const ProviderSlugKeyMap: Record<string, AnonGroupProvider> = {
  domain: GoogleOAuthProvider,
  ns: NSDkimProvider,
};
