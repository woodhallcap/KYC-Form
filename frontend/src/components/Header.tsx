import logo from '../../../assets/logos/woodhall-capital-logo-full-colour-rgb-1.svg';

export function Header() {
  return (
    <header className="flex items-center justify-center px-4 py-6">
      <img src={logo} alt="Woodhall Capital" className="h-16 sm:h-[84px]" />
    </header>
  );
}
