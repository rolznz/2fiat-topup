interface HamburgerMenuProps {
  isCardConnected: boolean;
  isWalletConnected: boolean;
  selectedCurrency: string;
  onDisconnectCard: () => void;
  onDisconnectWallet: () => void;
  onCurrencyChange: (currency: string) => void;
}

export function HamburgerMenu({
  isCardConnected,
  isWalletConnected,
  selectedCurrency,
  onDisconnectCard,
  onDisconnectWallet,
  onCurrencyChange,
}: HamburgerMenuProps) {
  return (
    <div className="dropdown dropdown-end">
      <div tabIndex={0} role="button" className="btn btn-square btn-ghost">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          className="inline-block w-5 h-5 stroke-current"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M4 6h16M4 12h16M4 18h16"
          ></path>
        </svg>
      </div>
      <ul
        tabIndex={0}
        className="menu menu-sm dropdown-content mt-3 gap-2 z-10 p-2 shadow bg-base-100 rounded-box w-52"
      >
        <li>
          <div className="form-control">
            <label className="label">
              <span className="label-text text-sm font-medium">Currency</span>
            </label>
            <input
              type="text"
              className="input input-bordered input-sm w-full max-w-xs"
              placeholder="USD"
              value={selectedCurrency}
              onChange={(e) => onCurrencyChange(e.target.value.toUpperCase())}
              maxLength={3}
            />
          </div>
        </li>
        {isCardConnected && (
          <li>
            <button onClick={onDisconnectCard} className="text-left">
              Disconnect Card
            </button>
          </li>
        )}
        {isWalletConnected && (
          <li>
            <button onClick={onDisconnectWallet} className="text-left">
              Disconnect Wallet
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}
