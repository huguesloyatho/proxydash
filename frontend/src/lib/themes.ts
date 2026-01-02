import { MantineColorsTuple } from '@mantine/core';

// Types pour les thèmes
export interface ThemeConfig {
  id: string;
  name: string;
  description: string;
  preview: {
    primary: string;
    background: string;
    card: string;
  };
  colors: {
    primary: string;
    primaryShade: number;
    dark: MantineColorsTuple;
  };
  backgroundImage?: string;
  backgroundOverlay?: string; // Couleur d'overlay sur le fond
  cardStyle: 'solid' | 'glass' | 'blur';
  borderRadius: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export interface CustomThemeSettings {
  backgroundImage: string | null;
  backgroundOverlay: string;
  overlayOpacity: number;
  cardOpacity: number;
  accentColor: string;
  borderRadius: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

// Thèmes prédéfinis
export const PRESET_THEMES: ThemeConfig[] = [
  {
    id: 'dark-default',
    name: 'Sombre (Défaut)',
    description: 'Thème sombre classique avec accent bleu',
    preview: {
      primary: '#228be6',
      background: '#1A1B1E',
      card: '#25262B',
    },
    colors: {
      primary: 'blue',
      primaryShade: 6,
      dark: [
        '#C1C2C5',
        '#A6A7AB',
        '#909296',
        '#5C5F66',
        '#373A40',
        '#2C2E33',
        '#25262B',
        '#1A1B1E',
        '#141517',
        '#101113',
      ],
    },
    cardStyle: 'solid',
    borderRadius: 'md',
  },
  {
    id: 'midnight-purple',
    name: 'Minuit Violet',
    description: 'Thème sombre avec accent violet profond',
    preview: {
      primary: '#9c36b5',
      background: '#13111C',
      card: '#1E1A2E',
    },
    colors: {
      primary: 'grape',
      primaryShade: 6,
      dark: [
        '#C9C5D3',
        '#ADA8BB',
        '#918BA3',
        '#6B6580',
        '#4A4560',
        '#3A3550',
        '#1E1A2E',
        '#13111C',
        '#0D0B14',
        '#08070C',
      ],
    },
    cardStyle: 'solid',
    borderRadius: 'lg',
  },
  {
    id: 'ocean-deep',
    name: 'Océan Profond',
    description: 'Bleus profonds inspirés des abysses',
    preview: {
      primary: '#15aabf',
      background: '#0A1929',
      card: '#0D2137',
    },
    colors: {
      primary: 'cyan',
      primaryShade: 6,
      dark: [
        '#B8D4E3',
        '#8FBDD4',
        '#66A6C5',
        '#3D7A99',
        '#1E5A7A',
        '#0D3A5C',
        '#0D2137',
        '#0A1929',
        '#06101A',
        '#03080D',
      ],
    },
    cardStyle: 'solid',
    borderRadius: 'md',
  },
  {
    id: 'forest-green',
    name: 'Forêt Sombre',
    description: 'Verts naturels pour un look organique',
    preview: {
      primary: '#40c057',
      background: '#0F1A14',
      card: '#162A1F',
    },
    colors: {
      primary: 'green',
      primaryShade: 6,
      dark: [
        '#C5D9CC',
        '#A3C5AE',
        '#81B190',
        '#5A8A6A',
        '#3D6A4D',
        '#2A4A38',
        '#162A1F',
        '#0F1A14',
        '#0A110D',
        '#050806',
      ],
    },
    cardStyle: 'solid',
    borderRadius: 'md',
  },
  {
    id: 'sunset-warm',
    name: 'Coucher de Soleil',
    description: 'Teintes chaudes orange et rouge',
    preview: {
      primary: '#fd7e14',
      background: '#1A1410',
      card: '#2A2018',
    },
    colors: {
      primary: 'orange',
      primaryShade: 6,
      dark: [
        '#DDD0C5',
        '#C9B5A3',
        '#B59A81',
        '#8A7560',
        '#6A5A48',
        '#4A4035',
        '#2A2018',
        '#1A1410',
        '#110D0A',
        '#080605',
      ],
    },
    cardStyle: 'solid',
    borderRadius: 'lg',
  },
];

// Thème par défaut pour les personnalisations
export const DEFAULT_CUSTOM_SETTINGS: CustomThemeSettings = {
  backgroundImage: null,
  backgroundOverlay: 'rgba(0, 0, 0, 0.7)',
  overlayOpacity: 70,
  cardOpacity: 95,
  accentColor: '#228be6',
  borderRadius: 'md',
};

// Fonction pour générer le CSS du fond d'écran
export function generateBackgroundCSS(settings: CustomThemeSettings): string {
  if (!settings.backgroundImage) {
    return '';
  }

  return `
    background-image: url('${settings.backgroundImage}');
    background-size: cover;
    background-position: center;
    background-attachment: fixed;
  `;
}

// Fonction pour générer les styles de carte avec effet verre
export function generateCardStyles(settings: CustomThemeSettings, hasBackground: boolean): React.CSSProperties {
  if (!hasBackground) {
    return {};
  }

  const opacity = settings.cardOpacity / 100;

  return {
    backgroundColor: `rgba(37, 38, 43, ${opacity})`,
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
  };
}

// Convertir une couleur hex en couleur Mantine
export function hexToMantineColor(hex: string): string {
  const colors: Record<string, string> = {
    '#228be6': 'blue',
    '#40c057': 'green',
    '#fa5252': 'red',
    '#fd7e14': 'orange',
    '#fab005': 'yellow',
    '#15aabf': 'cyan',
    '#7950f2': 'violet',
    '#be4bdb': 'pink',
    '#9c36b5': 'grape',
    '#868e96': 'gray',
  };

  return colors[hex.toLowerCase()] || 'blue';
}
