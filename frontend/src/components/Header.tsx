import logo from '../../../assets/logos/woodhall-finance.svg';

export function Header() {
  return (
    <header className="flex items-center justify-center px-4 py-6">
      <img src={logo} alt="Woodhall Finance" className="h-12 sm:h-[68px]" />
    </header>
  );
}
