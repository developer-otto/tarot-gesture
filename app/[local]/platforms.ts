// config/sharePlatforms.ts
import {
  LinkIcon,
  XIcon,
  FacebookIcon,
  InstagramIcon,
  WhatsAppIcon,
  TelegramIcon,
} from "@/components/icons";

export interface SharePayload {
  text: string;
  url: string;
}

export interface SharePlatform {
  id: string;
  label: string;
  bg: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient?: boolean;
  /** 特殊行为：复制链接 */
  isCopy?: boolean;
  /** 移动端唤起 App 的 scheme，没有就只用 webLink */
  appLink?: (payload: SharePayload) => string;
  /** 桌面端 / 降级使用 */
  webLink?: (payload: SharePayload) => string;
}

export const platforms: SharePlatform[] = [
  {
    id: "copy_link",
    label: "Copy Link",
    bg: "#ed932d",
    icon: LinkIcon,
    isCopy: true,
  },
  {
    id: "x",
    label: "X",
    bg: "#000000",
    icon: XIcon,
    appLink: ({ text, url }) =>
      `twitter://post?message=${encodeURIComponent(`${text} ${url}`)}`,
    webLink: ({ text, url }) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
  },
  {
    id: "facebook",
    label: "Facebook",
    bg: "#337FFF",
    icon: FacebookIcon,
    appLink: ({ url }) => `fb://facewebmodal/f?href=${encodeURIComponent(url)}`,
    webLink: ({ url }) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    id: "instagram",
    label: "Instagram",
    bg: "linear-gradient(-45deg,#FBE18A 0%,#FCBB45 22%,#F75274 39%,#D53692 53%,#8F39CE 75%,#5B4FE9 100%)",
    icon: InstagramIcon,
    gradient: true,
    appLink: () => `instagram://`,
    webLink: () => `https://www.instagram.com/`,
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    bg: "#00D95F",
    icon: WhatsAppIcon,
    appLink: ({ text, url }) =>
      `whatsapp://send?text=${encodeURIComponent(`${text} ${url}`)}`,
    webLink: ({ text, url }) =>
      `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
  },
  {
    id: "telegram",
    label: "Telegram",
    bg: "#34AADF",
    icon: TelegramIcon,
    appLink: ({ text, url }) =>
      `tg://msg_url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    webLink: ({ text, url }) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
];