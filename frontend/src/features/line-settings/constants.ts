import { Instagram, Globe, MapPin, Phone, Ticket, CreditCard, Twitter, Facebook, Youtube, Mail, ExternalLink } from 'lucide-react'

export const AVAILABLE_ICONS = [
  { id: 'instagram', icon: Instagram, label: 'Instagram' },
  { id: 'globe', icon: Globe, label: 'Web' },
  { id: 'map-pin', icon: MapPin, label: 'Map' },
  { id: 'phone', icon: Phone, label: 'Phone' },
  { id: 'ticket', icon: Ticket, label: 'Coupon' },
  { id: 'credit-card', icon: CreditCard, label: 'Card' },
  { id: 'twitter', icon: Twitter, label: 'X (Twitter)' },
  { id: 'facebook', icon: Facebook, label: 'Facebook' },
  { id: 'youtube', icon: Youtube, label: 'YouTube' },
  { id: 'mail', icon: Mail, label: 'Mail' },
  { id: 'external-link', icon: ExternalLink, label: 'Link' }
]

export const RICH_MENU_LAYOUTS = [
  { id: 'large_4', name: '標準 (2×2)', type: 'large', slots: 4, grid: 'grid-cols-2 grid-rows-2' },
  { id: 'large_6', name: '多機能 (3×2)', type: 'large', slots: 6, grid: 'grid-cols-3 grid-rows-2' },
  { id: 'large_3_upper', name: '上部強調 (1+2)', type: 'large', slots: 3, grid: 'grid-cols-2 grid-rows-2', customGrid: true },
  { id: 'compact_2', name: 'コンパクト (2列)', type: 'compact', slots: 2, grid: 'grid-cols-2 grid-rows-1' },
  { id: 'compact_3', name: 'コンパクト (3列)', type: 'compact', slots: 3, grid: 'grid-cols-3 grid-rows-1' }
]
