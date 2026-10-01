// Decorative product illustration. No customer photos or account data are used.
export function LoginIllustration() {
  return (
    <svg viewBox="0 0 600 360" fill="none" aria-hidden="true" focusable="false" className="w-full max-w-[600px]">
      <defs>
        <linearGradient id="login-sky" x2="0" y2="1">
          <stop stopColor="#c3ddf3" />
          <stop offset="1" stopColor="#edf4fa" />
        </linearGradient>
        <pattern id="login-windows" width="16" height="20" patternUnits="userSpaceOnUse">
          <rect x="4" y="4" width="8" height="12" rx="1" fill="#8aa9bf" />
        </pattern>
        <symbol id="login-site" viewBox="0 0 120 100">
          <path fill="url(#login-sky)" d="M0 0h120v100H0z" />
          <circle cx="95" cy="19" r="11" fill="#fff9e9" />
          <path d="M0 65L47 24l47 41v35H0z" fill="#f3f0e9" />
          <path d="M47 24l47 41v35H47z" fill="#d2dae0" />
          <path d="M11 64h25v36H11zM58 60h24v40H58z" fill="url(#login-windows)" />
          <path d="M92 46h28v54H92z" fill="#8fa7b6" />
          <path d="M0 95h120v5H0z" fill="#c2d1cb" />
        </symbol>
      </defs>
      <ellipse cx="300" cy="337" rx="241" ry="13" fill="#dce7f4" opacity=".65" />
      <rect x="63" y="28" width="510" height="284" rx="13" fill="white" stroke="#cedded" strokeWidth="1.5" />
      <path d="M64 64h508" stroke="#e7edf5" />
      <circle cx="83" cy="46" r="3" fill="#d7e1ed" />
      <circle cx="94" cy="46" r="3" fill="#d7e1ed" />
      <circle cx="105" cy="46" r="3" fill="#d7e1ed" />
      <rect x="265" y="41" width="125" height="9" rx="4.5" fill="#f0f4f9" />
      <circle cx="551" cy="46" r="8" fill="#e0ecff" />
      <path d="M64 65h104v246H76a12 12 0 0 1-12-12z" fill="#f8faff" />
      <rect x="77" y="84" width="77" height="22" rx="5" fill="#e8f1ff" />
      {[94, 129, 160, 191].map((y, i) => (
        <g key={y} stroke={i ? "#aab7c8" : "#006eff"} strokeWidth="2" strokeLinecap="round">
          <rect x="85" y={y - 3} width="8" height="8" rx="2" />
          <path d={`M102 ${y + 1}h${i === 0 ? 39 : 28}`} />
        </g>
      ))}
      <rect x="187" y="83" width="99" height="10" rx="3" fill="#354b65" />
      <rect x="492" y="78" width="61" height="21" rx="5" fill="#006eff" />
      <path d="M515 88h15" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <rect x="187" y="106" width="365" height="16" rx="4" fill="#f3f6fa" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <g key={i} transform={`translate(${187 + (i % 3) * 125}, ${135 + Math.floor(i / 3) * 80})`}>
          <svg width="114" height="65" viewBox={`${i % 2 ? 18 : 0} 0 100 90`} preserveAspectRatio="xMidYMid slice">
            <use href="#login-site" width="120" height="100" />
          </svg>
          <rect y="69" width="54" height="4" rx="2" fill="#dbe4ef" />
        </g>
      ))}
      <rect x="24" y="113" width="133" height="217" rx="21" fill="#fff" stroke="#c2d2e4" strokeWidth="2" />
      <svg x="31" y="139" width="119" height="148" viewBox="0 0 120 100" preserveAspectRatio="xMidYMid slice">
        <use href="#login-site" width="120" height="100" />
      </svg>
      <rect x="72" y="123" width="37" height="5" rx="2.5" fill="#d3deeb" />
      <rect x="40" y="250" width="92" height="26" rx="3" fill="#fff" fillOpacity=".85" />
      <path d="M46 258h28m-28 9h57" stroke="#5c7793" strokeWidth="3" strokeLinecap="round" />
      <circle cx="90" cy="306" r="13" stroke="#006eff" strokeWidth="2" />
      <circle cx="90" cy="306" r="9" fill="#006eff" />
    </svg>
  )
}
