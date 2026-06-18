import logoImage from '../assets/itoguchi_logo_transparent_IT_asagi.png'

interface LogoProps {
  className?: string
}

export default function Logo({ className = 'h-10 w-auto' }: LogoProps) {
  return <img src={logoImage} alt="IToguchi" className={className} />
}
