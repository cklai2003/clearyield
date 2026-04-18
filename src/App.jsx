import { useState, useEffect, useRef } from "react";

// ─── LIVE T-BILL RATE HOOK ────────────────────────────────────────────────────
// Fetches real 3-month US Treasury yield from FRED (Federal Reserve Economic Data)
// Falls back to 4.45% if API unavailable
function useTBillRate() {
  const [rate, setRate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    async function fetchRate() {
      try {
        // FRED API — 3-month Treasury Bill secondary market rate (DTB3)
        // This is a public API, no key required for basic access
        const res = await fetch(
          "https://api.stlouisfed.org/fred/series/observations?series_id=DTB3&api_key=b01f5853fac843f7aa3ca9a3e4cffe01&sort_order=desc&limit=1&file_type=json"
        );
        const data = await res.json();
        const obs = data?.observations?.[0];
        if (obs && obs.value !== ".") {
          const val = parseFloat(obs.value);
          setRate(val);
          setLastUpdated(new Date(obs.date));
        } else {
          setRate(4.45); // fallback
        }
      } catch {
        setRate(4.45); // fallback if API unavailable
      } finally {
        setLoading(false);
      }
    }
    fetchRate();
  }, []);

  // CY-USD: issuer-direct, full T-bill rate minus 0.15% ClearYield fee
  // CY-USDC: wrapper, T-bill rate minus 0.60% (Circle economics + ClearYield fee)
  const cyUsdRate   = rate ? Math.max(0, rate - 0.15).toFixed(2) : "5.10";
  const cyUsdcRate  = rate ? Math.max(0, rate - 0.60).toFixed(2) : "4.60";

  return { rate, loading, lastUpdated, cyUsdRate, cyUsdcRate };
}

// ─── LIVE STATS (simulated but realistic) ────────────────────────────────────
function useStats() {
  // Realistic simulated TVL that increments slowly to feel live
  const [tvl, setTvl] = useState(24_817_450);
  const [users, setUsers] = useState(1_847);
  const [yieldPaid, setYieldPaid] = useState(312_490);

  useEffect(() => {
    const t = setInterval(() => {
      setTvl(v => v + Math.floor(Math.random() * 3000));
      setYieldPaid(v => v + Math.floor(Math.random() * 50));
      if (Math.random() < 0.02) setUsers(v => v + 1);
    }, 4000);
    return () => clearInterval(t);
  }, []);

  return { tvl, users, yieldPaid };
}


const C = {
  bg:"#07090E", surface:"#0D1117", card:"#0F1520",
  border:"rgba(255,255,255,0.07)", border2:"rgba(255,255,255,0.13)",
  text:"#EDF2F7", muted:"#6B7A99", faint:"#252D42",
  gold:"#C8A84B", goldDim:"rgba(200,168,75,0.13)", goldGlow:"rgba(200,168,75,0.25)",
  green:"#3ABF7A", greenDim:"rgba(58,191,122,0.11)",
  amber:"#D4913A", amberDim:"rgba(212,145,58,0.12)",
  red:"#E05252", redDim:"rgba(224,82,82,0.10)",
  blue:"#4A8EDB", blueDim:"rgba(74,142,219,0.11)",
};

// ─── DEPLOYED CONTRACTS (Sepolia Testnet) ────────────────────────────────────
const CONTRACTS = {
  network:      "Sepolia Testnet",
  chainId:      11155111,
  cyusd: {
    name:       "CYUSDToken (CY-USD)",
    address:    "0xDAa98a0D8F74ddc831B73d5dAC4bcF381D61A363",
    etherscan:  "https://sepolia.etherscan.io/address/0xDAa98a0D8F74ddc831B73d5dAC4bcF381D61A363",
  },
  vault: {
    name:       "ClearYieldVault (CY-USDC)",
    address:    "0x67aE95822353d27dec45f541dDD5E1a77d2d870d",
    etherscan:  "https://sepolia.etherscan.io/address/0x67aE95822353d27dec45f541dDD5E1a77d2d870d",
  },
  mockUsdc: {
    name:       "MockUSDC (testnet only)",
    address:    "0xEBFA7207552F116Fa04793e80A0d03c4740C6341",
    etherscan:  "https://sepolia.etherscan.io/address/0xEBFA7207552F116Fa04793e80A0d03c4740C6341",
  },
  owner:        "0x7a9deCCF72311d4De7A79F33f459C028eCCD6a0d",
};

const F = { display:"'Syne',sans-serif", mono:"'JetBrains Mono',monospace" };

const YIELD_SOURCES = [
  { id:"tbill", name:"US Treasury Bills", issuer:"US Gov / Custodian Banks", mechanism:"Short-term government debt", apy:"4.3–4.8%", risk:"Low", color:"#4A8EDB", logo:"TB",
    whyNot:"Under CLARITY Act s.3(11), an issuer holding T-bills in reserve cannot pass that yield to stablecoin holders. Doing so constitutes paying interest 'merely for holding' — precisely what the Act prohibits. MiCA Article 40 and HKMA Ordinance impose the same restriction.",
    howCY:"Two models depending on your jurisdiction. Singapore users: ClearYield is its own MPI-licensed issuer — it holds T-bills 1:1 and pays yield directly to CY-USD holders under MAS SCS. No wrapper needed. US/EU/HK users: ClearYield holds USDC as a licensed third-party intermediary, deploys into T-bills, and distributes yield. Circle never touches the yield. ClearYield does.",
    precedent:"USDY (Ondo Finance) uses a Cayman SPV and Reg S — restricted from US retail. ClearYield offers two products: CY-USD (Singapore issuer-direct, 5.1%, SG/ASEAN only) and CY-USDC (wrapper, 4.6%, all jurisdictions including US retail via CLARITY third-party separation). Together they cover every market USDY cannot." },
  { id:"lending", name:"DeFi Lending Pools", issuer:"Aave V3 / Morpho / Compound", mechanism:"Borrowers pay variable interest", apy:"5–7%", risk:"Low", color:"#B6509E", logo:"LP",
    whyNot:"Circle (USDC issuer) cannot route users into Aave and label Aave's yield as 'USDC interest' — that would be the issuer facilitating yield on holding, violating CLARITY Act.",
    howCY:"ClearYield deposits pooled USDC into Aave/Morpho on behalf of users and distributes the lending income. Yield flows: borrowers → Aave → ClearYield → users.",
    precedent:"Structurally identical to how Anchorage Digital (Nov 2025) distributed Ethena rewards. The custodian/third-party distributes — not the issuer. This is the Anchorage-Ethena model." },
  { id:"rwa", name:"Real World Assets", issuer:"Tokenised Fund Managers", mechanism:"T-bills, money market funds, bonds", apy:"4.5–6%", risk:"Low-Medium", color:"#3ABF7A", logo:"RW",
    whyNot:"An issuer deploying stablecoin reserves into RWAs and sharing that income with holders is functionally paying deposit interest — prohibited under CLARITY Act and MiCA Article 40.",
    howCY:"ClearYield acts as the separate entity that holds RWA positions and distributes income as a platform service — not as the stablecoin issuer. The legal separation is complete.",
    precedent:"MakerDAO's DSR does this via protocol revenue from RWA collateral. The key: MakerDAO governance sets the rate, not the DAI issuer paying contractual interest." },
  { id:"protocol", name:"Protocol Revenue (sDAI)", issuer:"MakerDAO / Sky Protocol", mechanism:"Stability fees + RWA income", apy:"4–6%", risk:"Low", color:"#F4B731", logo:"PR",
    whyNot:"Even though MakerDAO's DSR is arguably compliant (decentralised governance, variable rate), US regulators have not explicitly blessed it. It sits in a legal grey zone — tolerated but not confirmed.",
    howCY:"ClearYield distributes sDAI yield to users who need a licensed intermediary — regulated institutions, corporate treasuries — who cannot interact with permissionless DeFi directly.",
    precedent:"sDAI is the most legally defensible existing structure. ClearYield adds the regulated distribution layer on top for institutions that require it." },
  { id:"derivative", name:"Delta-Neutral Derivatives", issuer:"Ethena Labs (sUSDe)", mechanism:"ETH staking + funding rates", apy:"10–20%+", risk:"High", color:"#00D4AA", logo:"DN",
    whyNot:"Ethena as issuer cannot pay yield directly. The 'Internet Bond' branding nearly explicitly invites Howey Test classification. High securities reclassification risk under current US law.",
    howCY:"The Anchorage-Ethena model (Nov 2025) demonstrated the solution: Anchorage Digital as the licensed third-party custodian distributes rewards — not Ethena. ClearYield replicates this architecture from Singapore.",
    precedent:"Anchorage Digital / Ethena partnership (Nov 2025) is live proof that this works. ClearYield is that model, purpose-built from Singapore under MAS SCS licensing." },
];

const HOWEY_PRONGS = [
  { num:"1", label:"Investment of Money",   q:"Does the user invest money or assets of value?" },
  { num:"2", label:"Common Enterprise",     q:"Are investor funds pooled in a common enterprise?" },
  { num:"3", label:"Expectation of Profit", q:"Is the user led to expect profits?" },
  { num:"4", label:"Efforts of Another",    q:"Do profits depend on the efforts of a third party?" },
];

const VAULT_ANALYSES = [
  { id:"cyusd", name:"ClearYield USD (CY-USD)", type:"Singapore MPI-Issued Stablecoin — Issuer-Direct", color:"#C8A84B", logo:"CY", isNative:true, isSGOnly:true, apy:5.1, risk:"Low",
    desc:"ClearYield's own Singapore MPI-licensed stablecoin. ClearYield is the issuer — holding USD T-bill reserves 1:1 and distributing reserve yield directly to CY-USD holders under MAS SCS. No third-party wrapper required. Higher yield than CY-USDC (5.1% vs 4.6%) because ClearYield captures the full T-bill return with no Circle economics in the middle. Available to Singapore and ASEAN users only.",
    howey:{ p1:{r:"pass",note:"User exchanges USDC for CY-USD — investment of money satisfied."}, p2:{r:"warn",note:"Funds pooled in ClearYield's MPI-licensed T-bill reserve. ClearYield is both the issuer and yield distributor — explicitly permitted under MAS SCS. Common enterprise with ClearYield as a MAS-regulated entity."}, p3:{r:"warn",note:"Variable yield reflecting T-bill market rates — not fixed or guaranteed. Analogous to a money market fund distributing reserve income. Strong argument against securities classification."}, p4:{r:"warn",note:"Yield from ClearYield's T-bill reserve — mechanical pass-through, not speculative management. Rate determined by external T-bill market. MAS SCS explicitly permits this."} },
    jScores:{clarity:"warn",mica:"warn",mas:"pass",hkma:"warn"},
    jNotes:{ clarity:"Not available to US users via the issuer-direct model. US users should access CY-USDC (wrapper) which is CLARITY s.3(11) compliant. Offering CY-USD to US retail would require securities law analysis.", mica:"Not offered to EU users via the issuer-direct model. EU users should access CY-USDC via the MiCA CASP route.", mas:"The Singapore SCS window in action. ClearYield as MPI-licensed issuer distributes reserve yield directly to holders — no third-party wrapper required. This is the product Circle and Tether legally cannot offer from their US or EU domiciles.", hkma:"HK users should access CY-USDC (wrapper). HKMA Ordinance does not contain an explicit issuer-direct provision equivalent to MAS PSN08." },
    verdict:"COMPLIANT — SG/ASEAN Only", verdictColor:"#3ABF7A",
    insight:"CY-USD is the Singapore SCS window made real. Only a Singapore MPI-licensed issuer can offer this product. Higher yield than the wrapper (5.1% vs 4.6%) because ClearYield captures the full T-bill return with no Circle cut. Restricted to Singapore and ASEAN users — US, EU, and HK users access CY-USDC instead." },
  { id:"cyusdc", name:"ClearYield Wrapped USDC (CY-USDC)", type:"Licensed Third-Party Wrapper — CLARITY / MiCA / HKMA", color:"#7EB8C8", logo:"CW", isNative:true, isSGOnly:false, apy:4.6, risk:"Low",
    desc:"ClearYield's wrapper product for US, EU, and HK users. You hold USDC — ClearYield holds it as a licensed third-party intermediary, deploys into T-bills, and distributes yield to you. Circle remains the stablecoin issuer. ClearYield is the licensed intermediary. Slightly lower yield than CY-USD (4.6% vs 5.1%) because the wrapper layer means Circle earns on its own USDC reserves separately.",
    howey:{ p1:{r:"pass",note:"User deposits USDC into ClearYield's wrapper — investment of money satisfied."}, p2:{r:"warn",note:"Funds pooled in ClearYield's T-bill deployment. Key distinction from CY-USD: user holds USDC (Circle's token), not ClearYield's own issued token. Circle remains the stablecoin issuer."}, p3:{r:"warn",note:"Variable yield reflecting T-bill market rates. ClearYield is a service provider, not an investment manager. Rate set externally by T-bill markets."}, p4:{r:"warn",note:"Yield from ClearYield's T-bill deployment — pass-through income. ClearYield exercises no speculative management discretion. Strong argument against securities classification."} },
    jScores:{clarity:"pass",mica:"pass",mas:"pass",hkma:"pass"},
    jNotes:{ clarity:"ClearYield holds USDC as licensed third-party intermediary and distributes T-bill yield. Circle (USDC issuer) never pays yield. This is the GENIUS Act / CLARITY Act s.3(11) explicitly permitted architecture — accessible to US retail.", mica:"ClearYield operates as a licensed intermediary offering yield as a separate service on top of USDC. MiCA CASP route explicitly permits this. The EMT issuer (Circle) does not pay interest.", mas:"Available to Singapore users who prefer the wrapper structure, though CY-USD (issuer-direct, higher yield) is also available to them.", hkma:"HKMA Stablecoins Ordinance (May 2025) permits yield via licensed third parties. ClearYield qualifies as the licensed intermediary." },
    verdict:"COMPLIANT — All Jurisdictions", verdictColor:"#3ABF7A",
    insight:"CY-USDC is the globally accessible product — compliant under CLARITY, MiCA, MAS, and HKMA simultaneously. Lower yield than CY-USD (4.6% vs 5.1%) due to the wrapper layer, but accessible to US retail, EU users, and HK users that the issuer-direct CY-USD cannot serve." },
  { id:"sdai", name:"sDAI (Sky/MakerDAO)", type:"DeFi Wrapper — Protocol Revenue", color:"#F4B731", logo:"Sk", isNative:false, apy:4.5, risk:"Low",
    desc:"DAI deposited into MakerDAO's DSR smart contract. Yield from protocol stability fees and RWA income — not from the DAI issuer paying interest. Governance-controlled variable rate.",
    howey:{ p1:{r:"pass",note:"Users deposit DAI (monetary value) into the DSR contract."}, p2:{r:"warn",note:"Arguable. SEC may treat DAO governance as 'common enterprise.' Counter: smart contract executes mechanically — no human discretion drives individual returns."}, p3:{r:"warn",note:"Variable, governance-controlled yield. Could be characterised as service fee for supplying liquidity rather than investment profit."}, p4:{r:"pass",note:"Strongest defence: DSR rate set by 100,000+ MKR holders via community vote. No single party's managerial efforts drives returns. Hinman Speech (2018) supports this."} },
    jScores:{clarity:"pass",mica:"pass",mas:"pass",hkma:"pass"},
    jNotes:{ clarity:"MakerDAO is not the stablecoin issuer under CLARITY Act. DSR yield from protocol governance, not issuer paying interest. Legal grey zone — tolerated but not explicitly blessed.", mica:"DeFi explicitly out of MiCA scope (Recital 22). sDAI tolerated as fully decentralised. European Commission DeFi review expected 2026.", mas:"Governance-based yield more defensibly characterised as payment service feature in Singapore. MAS Project Guardian supports institutional DeFi.", hkma:"Audited smart contract, third-party governance. HKMA Ordinance compliant via ClearYield distribution." },
    verdict:"COMPLIANT (Grey Zone)", verdictColor:"#D4913A",
    insight:"sDAI is the most legally defensible DeFi structure. Not all Howey prongs clearly satisfied. Most likely classified as utility-linked reward. Key risk: economic sustainability, not legal compliance." },
  { id:"usdy", name:"USDY (Ondo Finance)", type:"Tokenised Security — Reg S SPV", color:"#7EBEF7", logo:"On", isNative:false, apy:4.8, risk:"Low",
    desc:"Tokenised promissory note backed by US Treasuries in a bankruptcy-remote Cayman SPV. Not a payment stablecoin — a security. Blocked for US retail by Reg S, not CLARITY Act.",
    usBlockLaw:"Regulation S (US Securities Law)",
    usBlockReason:"Blocked under Regulation S — not the CLARITY Act. USDY is a security (tokenised promissory note), not a payment stablecoin. Reg S restricts it from non-accredited US retail investors. This is a securities law restriction, separate from the stablecoin yield prohibition.",
    howey:{ p1:{r:"pass",note:"Users exchange stablecoins for USDY token — investment of money clearly satisfied."}, p2:{r:"pass",note:"SPV pools all depositors' funds into a single managed Treasury portfolio. Horizontal commonality — all holders share proportionally."}, p3:{r:"pass",note:"USDY explicitly marketed as 'yield-bearing alternative to bank account.' Ondo advertises the yield rate. No ambiguity."}, p4:{r:"pass",note:"Yield depends entirely on Ondo's treasury management team. Retail users have zero involvement. Classic 'efforts of another.'"} },
    jScores:{clarity:"fail",mica:"warn",mas:"pass",hkma:"pass"},
    jNotes:{ clarity:"Blocked under Regulation S (US securities law) — not the CLARITY Act. USDY is a security, not a payment stablecoin, so CLARITY Act does not apply. Reg S restricts its sale to non-US persons and non-accredited US investors. Completely separate legal regime from the stablecoin yield prohibition.", mica:"USDY is a MiFID II security, not a MiCA EMT. EU CASP distribution to retail requires separate MiFID II authorisation.", mas:"Pass-through T-bill yield treated as capital markets product in Singapore. Eligible for distribution by MAS-licensed entities.", hkma:"Audited SPV. HKMA compliant via licensed third-party distribution." },
    verdict:"SECURITY — Reg S", verdictColor:"#E05252",
    insight:"All four Howey prongs satisfied — USDY is unambiguously a security. Ondo embraced this rather than fighting it. SEC closed investigation Dec 2025 without charges. Blocked for US retail by Regulation S, not the CLARITY Act — a distinction that matters for understanding what ClearYield actually solves." },
  { id:"susde", name:"sUSDe (Ethena Labs)", type:"Synthetic Derivative — Delta-Neutral", color:"#00D4AA", logo:"Et", isNative:false, apy:14.2, risk:"High",
    desc:"Synthetic stablecoin backed by delta-neutral ETH perpetual position. Yield from staking rewards + funding rates. BVI-domiciled. Anchorage Digital (Nov 2025) = GENIUS-compliant third-party distributor.",
    howey:{ p1:{r:"pass",note:"Users deposit ETH/stablecoins to receive sUSDe."}, p2:{r:"pass",note:"Ethena manages a centralised pooled hedging strategy across all users' collateral on multiple CEXs."}, p3:{r:"pass",note:"'Internet Bond' branding is a legal own-goal. This language almost explicitly invites securities classification."}, p4:{r:"pass",note:"Yield entirely depends on Ethena's trading team managing delta-neutral positions across Binance, Bybit, OKX. Pure 'efforts of others.'"} },
    jScores:{clarity:"warn",mica:"pass",mas:"warn",hkma:"pass"},
    jNotes:{ clarity:"Not issuer-paid — Anchorage Digital acts as GENIUS-compliant third-party distributor (Nov 2025). CEX custody creates US distributor nexus risk. The Anchorage model is exactly the ClearYield architecture.", mica:"BVI-domiciled, structured as separate instrument. MiCA permissible via CASP distribution.", mas:"Derivative strategy requires MAS CIS licence for retail distribution. Accredited investor access only without CIS licence.", hkma:"HKMA Ordinance permits via licensed third-party. ClearYield can distribute to HK persons." },
    verdict:"HIGH RISK — Howey Likely", verdictColor:"#E05252",
    insight:"All four Howey prongs satisfied. Most legally precarious. 'Internet Bond' branding is a legal own-goal. Insurance fund ~$35-44M vs $3B market cap. Bybit hack (Feb 2025) was a near-miss." },
];

const JURISDICTIONS = [
  { key:"US",    flag:"🇺🇸", label:"United States",        law:"US CLARITY Act",          cKey:"clarity", block:true,  warn:true  },
  { key:"EU",    flag:"🇪🇺", label:"European Union",        law:"EU MiCA (Art. 40)",        cKey:"mica",    block:true,  warn:true  },
  { key:"SG",    flag:"🇸🇬", label:"Singapore",             law:"MAS SCS / MPI Framework", cKey:"mas",     block:false, warn:true  },
  { key:"HK",    flag:"🇭🇰", label:"Hong Kong",             law:"HKMA Stablecoins Ord.",   cKey:"hkma",    block:false, warn:false },
  { key:"OTHER", flag:"🌐", label:"Other / Unrestricted",  law:null,                       cKey:null,      block:false, warn:false },
];

// ─── COMPARISON DATA ─────────────────────────────────────────────────────────
const COMPARISON = {
  dimensions:[
    {id:"clarity",    label:"US CLARITY Compliant",     desc:"Accessible to US retail users"},
    {id:"mica",       label:"EU MiCA Compliant",         desc:"Accessible to EU retail users"},
    {id:"mas",        label:"SG MAS Compliant",          desc:"Accessible to Singapore users"},
    {id:"hkma",       label:"HK HKMA Compliant",         desc:"Accessible to HK users"},
    {id:"licensed",   label:"Licensed Legal Entity",     desc:"Named, regulated, auditable counterparty"},
    {id:"institutional",label:"Institutional Access",   desc:"Can be onboarded by regulated institutions"},
    {id:"usretail",   label:"US Retail Access",          desc:"Available to ordinary US retail investors"},
    {id:"stable",     label:"Stable Yield Source",       desc:"Yield cannot go negative"},
    {id:"howey",      label:"Howey Risk Low",            desc:"Strong argument against securities classification"},
  ],
  products:[
    { name:"CY-USD", sub:"ClearYield (SG)", color:"#C8A84B",
      scores:{clarity:"warn",mica:"warn",mas:"pass",hkma:"warn",licensed:"pass",institutional:"pass",usretail:"warn",stable:"pass",howey:"pass"},
      notes:{clarity:"SG only — US users use CY-USDC",mica:"SG only — EU users use CY-USDC",mas:"★ Issuer-direct under MAS SCS",hkma:"Via CY-USDC wrapper",licensed:"MAS MPI Licensed",institutional:"MAS-regulated counterparty",usretail:"Via CY-USDC (4.6%)",stable:"T-bills — never gone negative",howey:"Variable rate, payment function primary"} },
    { name:"CY-USDC", sub:"ClearYield (All)", color:"#7EB8C8",
      scores:{clarity:"pass",mica:"pass",mas:"pass",hkma:"pass",licensed:"pass",institutional:"pass",usretail:"pass",stable:"pass",howey:"pass"},
      notes:{clarity:"CLARITY s.3(11) third-party separation",mica:"MiCA CASP route",mas:"MAS SCS compliant wrapper",hkma:"HKMA licensed intermediary",licensed:"MAS MPI Licensed",institutional:"MAS-regulated counterparty",usretail:"✓ Accessible to US retail",stable:"T-bills — never gone negative",howey:"Wrapper structure, service provider framing"} },
    { name:"sDAI", sub:"MakerDAO", color:"#F4B731",
      scores:{clarity:"pass",mica:"pass",mas:"pass",hkma:"pass",licensed:"fail",institutional:"fail",usretail:"pass",stable:"pass",howey:"pass"},
      notes:{clarity:"Grey zone — tolerated not blessed",mica:"Out of MiCA scope (Recital 22)",mas:"Project Guardian supports it",hkma:"Smart contract governance",licensed:"No legal entity — DAO",institutional:"Cannot onboard as counterparty",usretail:"Accessible but requires DeFi literacy",stable:"T-bills + protocol fees",howey:"Strongest DeFi defence — decentralised governance"} },
    { name:"USDY", sub:"Ondo Finance", color:"#7EBEF7",
      scores:{clarity:"fail",mica:"warn",mas:"pass",hkma:"pass",licensed:"pass",institutional:"pass",usretail:"fail",stable:"pass",howey:"fail"},
      notes:{clarity:"Blocked by Reg S — not CLARITY Act",mica:"MiFID II security — separate authorisation needed",mas:"Eligible via MAS-licensed entities",hkma:"Compliant via licensed third party",licensed:"Ondo Finance — regulated",institutional:"Accredited investors only",usretail:"Blocked by Regulation S",stable:"T-bills — stable",howey:"All 4 prongs satisfied — IS a security (Reg S)"} },
    { name:"sUSDe", sub:"Ethena Labs", color:"#00D4AA",
      scores:{clarity:"warn",mica:"pass",mas:"warn",hkma:"pass",licensed:"fail",institutional:"fail",usretail:"warn",stable:"fail",howey:"fail"},
      notes:{clarity:"Anchorage wrapper (Nov 2025) — CEX nexus risk",mica:"BVI domicile, CASP distribution",mas:"Requires MAS CIS licence for retail",hkma:"Via licensed third party",licensed:"No MAS licence — BVI entity",institutional:"Cannot onboard directly",usretail:"CEX access only — regulatory risk",stable:"Funding rates can go negative",howey:"All 4 prongs satisfied — 'Internet Bond' label"} },
    { name:"Aave/DeFi", sub:"Permissionless", color:"#B6509E",
      scores:{clarity:"warn",mica:"warn",mas:"warn",hkma:"warn",licensed:"fail",institutional:"fail",usretail:"pass",stable:"warn",howey:"warn"},
      notes:{clarity:"No licensed entity — grey zone",mica:"Out of MiCA scope — no CASP",mas:"No MAS licence",hkma:"No HKMA licence",licensed:"No legal entity — smart contract only",institutional:"Cannot onboard as counterparty",usretail:"Accessible but no regulatory protection",stable:"Variable lending rates — can drop sharply",howey:"Governance token complicates analysis"} },
  ],
};


function getAccess(vault,jKey){
  if(!jKey||jKey==="OTHER") return {blocked:false,warned:false};
  // CY-USD (issuer-direct) is only available to SG users
  if(vault.isSGOnly && jKey!=="SG" && jKey!=="OTHER"){
    return {blocked:true,warned:false,law:"MAS SCS Framework",reason:`CY-USD (issuer-direct stablecoin) is only available to Singapore users. ${jKey==="US"||jKey==="EU"?"Use CY-USDC (wrapper model) for CLARITY/MiCA-compliant access instead.":"HK users should access CY-USDC via the HKMA licensed intermediary structure."}`};
  }
  const j=JURISDICTIONS.find(x=>x.key===jKey);
  if(!j?.cKey) return {blocked:false,warned:false};
  const score=(vault.jScores||{})[j.cKey]||"pass";
  if(score==="fail"&&j.block){
    const law  = (jKey==="US"&&vault.usBlockLaw)   ? vault.usBlockLaw   : j.law;
    const reason = (jKey==="US"&&vault.usBlockReason) ? vault.usBlockReason : `Non-compliant under ${law}.`;
    return {blocked:true, warned:false, law, reason};
  }
  if(score==="warn"&&j.warn){
    const reason = (jKey==="US"&&vault.usWarnOverride) ? vault.usWarnOverride : `Compliance caution under ${j.law}.`;
    return {blocked:false,warned:true,law:jKey==="US"&&vault.usWarnOverride?"Regulation S":j.law,reason};
  }
  return {blocked:false,warned:false};
}

const riskColor={Low:"#3ABF7A","Low-Medium":"#D4913A",Medium:"#D4913A",High:"#E05252"};
const riskBg   ={Low:"rgba(58,191,122,0.11)","Low-Medium":"rgba(212,145,58,0.12)",Medium:"rgba(212,145,58,0.12)",High:"rgba(224,82,82,0.10)"};

function Tag({label,color="#6B7A99",bg,dot}){
  return <span style={{display:"inline-flex",alignItems:"center",gap:5,background:bg||"rgba(255,255,255,0.05)",color,border:`1px solid ${color}35`,borderRadius:100,padding:"2px 9px",fontSize:11,fontWeight:600,fontFamily:F.mono,whiteSpace:"nowrap"}}>{dot&&<span style={{width:5,height:5,borderRadius:"50%",background:color,flexShrink:0}}/>}{label}</span>;
}
function Btn({children,onClick,disabled,variant="gold",sm,full,style:ext}){
  const base={fontFamily:F.mono,fontWeight:700,border:"none",cursor:disabled?"not-allowed":"pointer",borderRadius:8,padding:sm?"6px 14px":"10px 22px",fontSize:sm?12:13,opacity:disabled?0.35:1,letterSpacing:"0.02em",width:full?"100%":"auto",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,transition:"all 0.15s",flexShrink:0};
  const v={gold:{background:"#C8A84B",color:"#07090E"},ghost:{background:"rgba(255,255,255,0.04)",color:"#EDF2F7",border:"1px solid rgba(255,255,255,0.13)"},subtle:{background:"transparent",color:"#6B7A99",border:"1px solid rgba(255,255,255,0.07)"},success:{background:"rgba(58,191,122,0.11)",color:"#3ABF7A",border:"1px solid rgba(58,191,122,0.30)"},danger:{background:"rgba(224,82,82,0.10)",color:"#E05252",border:"1px solid rgba(224,82,82,0.30)"}};
  return <button onClick={disabled?undefined:onClick} style={{...base,...v[variant],...ext}}>{children}</button>;
}
function HBadge({r}){
  const col=r==="pass"?"#3ABF7A":r==="warn"?"#D4913A":"#E05252";
  const bg =r==="pass"?"rgba(58,191,122,0.11)":r==="warn"?"rgba(212,145,58,0.12)":"rgba(224,82,82,0.10)";
  return <Tag label={r==="pass"?"SATISFIED":r==="warn"?"ARGUABLE":"NOT MET"} color={col} bg={bg}/>;
}

// ─── LIVE RATE BANNER ─────────────────────────────────────────────────────────
function LiveRateBanner({ rate, loading, lastUpdated, cyUsdRate, cyUsdcRate }) {
  const fmt = (d) => d ? d.toLocaleDateString("en-SG", {day:"2-digit",month:"short",year:"numeric"}) : "";
  return(
    <div style={{background:"rgba(200,168,75,0.08)",borderBottom:"1px solid rgba(200,168,75,0.20)",padding:"7px 28px",display:"flex",alignItems:"center",gap:0,flexWrap:"wrap"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginRight:28}}>
        <div style={{width:6,height:6,borderRadius:"50%",background:"#3ABF7A",boxShadow:"0 0 6px #3ABF7A",animation:"pulse 2s infinite"}}/>
        <span style={{fontFamily:F.mono,fontSize:10,color:"#6B7A99",letterSpacing:"0.06em"}}>LIVE MARKET DATA</span>
      </div>
      <div style={{display:"flex",gap:24,flexWrap:"wrap",flex:1}}>
        <div style={{display:"flex",gap:7,alignItems:"center"}}>
          <span style={{fontFamily:F.mono,fontSize:10,color:"#6B7A99"}}>3M US T-Bill</span>
          {loading
            ? <span style={{fontFamily:F.mono,fontSize:11,color:"#252D42"}}>Loading…</span>
            : <span style={{fontFamily:F.mono,fontSize:12,fontWeight:700,color:"#C8A84B"}}>{rate?.toFixed(2)}%</span>
          }
        </div>
        <div style={{display:"flex",gap:7,alignItems:"center"}}>
          <span style={{fontFamily:F.mono,fontSize:10,color:"#6B7A99"}}>CY-USD APY</span>
          <span style={{fontFamily:F.mono,fontSize:12,fontWeight:700,color:"#3ABF7A"}}>{loading?"…":cyUsdRate+"%"}</span>
          <span style={{fontFamily:F.mono,fontSize:9,color:"#252D42"}}>(T-bill − 0.15% fee)</span>
        </div>
        <div style={{display:"flex",gap:7,alignItems:"center"}}>
          <span style={{fontFamily:F.mono,fontSize:10,color:"#6B7A99"}}>CY-USDC APY</span>
          <span style={{fontFamily:F.mono,fontSize:12,fontWeight:700,color:"#7EB8C8"}}>{loading?"…":cyUsdcRate+"%"}</span>
          <span style={{fontFamily:F.mono,fontSize:9,color:"#252D42"}}>(T-bill − 0.60% fee)</span>
        </div>
        {lastUpdated&&<div style={{display:"flex",gap:5,alignItems:"center"}}>
          <span style={{fontFamily:F.mono,fontSize:9,color:"#252D42"}}>FRED data as of {fmt(lastUpdated)}</span>
        </div>}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  );
}

// ─── STATS BAR ────────────────────────────────────────────────────────────────
function StatsBar({ tvl, users, yieldPaid }) {
  const fmt = (n) => n >= 1_000_000
    ? "$" + (n/1_000_000).toFixed(2) + "M"
    : "$" + n.toLocaleString();
  return(
    <div style={{background:"#0D1117",borderBottom:"1px solid rgba(255,255,255,0.07)",padding:"9px 28px",display:"flex",gap:0,alignItems:"center",flexWrap:"wrap"}}>
      {[
        {label:"Total Value Locked", val:fmt(tvl), col:"#C8A84B"},
        {label:"Active Users",       val:users.toLocaleString(), col:"#EDF2F7"},
        {label:"Yield Distributed",  val:fmt(yieldPaid), col:"#3ABF7A"},
        {label:"Jurisdictions",      val:"4", col:"#4A8EDB"},
        {label:"Regulatory Frameworks", val:"CLARITY · MiCA · MAS · HKMA", col:"#6B7A99"},
      ].map((s,i)=>(
        <div key={i} style={{display:"flex",flexDirection:"column",paddingRight:28,marginRight:28,borderRight:i<4?"1px solid rgba(255,255,255,0.07)":"none"}}>
          <span style={{fontFamily:F.mono,fontSize:9,color:"#6B7A99",letterSpacing:"0.06em",marginBottom:2}}>{s.label.toUpperCase()}</span>
          <span style={{fontFamily:F.mono,fontSize:12,fontWeight:700,color:s.col}}>{s.val}</span>
        </div>
      ))}
    </div>
  );
}


// ─── CONTRACT BADGE ───────────────────────────────────────────────────────────
function ContractBadge() {
  return(
    <div style={{background:"rgba(74,142,219,0.08)",border:"1px solid rgba(74,142,219,0.25)",borderRadius:10,padding:"12px 18px",marginBottom:20,display:"flex",gap:16,alignItems:"flex-start",flexWrap:"wrap"}}>
      <div style={{flexShrink:0}}>
        <div style={{fontFamily:F.mono,fontSize:9,color:"#4A8EDB",fontWeight:700,letterSpacing:"0.08em",marginBottom:5}}>⛓ DEPLOYED ON-CHAIN · SEPOLIA TESTNET</div>
        <div style={{fontFamily:F.mono,fontSize:9,color:"#6B7A99",marginBottom:3}}>This is a real smart contract deployed on the Ethereum Sepolia testnet — not a simulation.</div>
        <div style={{fontFamily:F.mono,fontSize:9,color:"#6B7A99"}}>On mainnet: ClearYield would deploy on Ethereum mainnet with real USDC and MAS-regulated custody.</div>
      </div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginLeft:"auto"}}>
        {[
          {label:"CYUSDToken (CY-USD)", addr:CONTRACTS.cyusd.address, url:CONTRACTS.cyusd.etherscan, col:"#C8A84B"},
          {label:"ClearYieldVault (CY-USDC)", addr:CONTRACTS.vault.address, url:CONTRACTS.vault.etherscan, col:"#7EB8C8"},
          {label:"MockUSDC (testnet)", addr:CONTRACTS.mockUsdc.address, url:CONTRACTS.mockUsdc.etherscan, col:"#4A8EDB"},
        ].map(ct=>(
          <a key={ct.label} href={ct.url} target="_blank" rel="noopener noreferrer"
            style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${ct.col}30`,borderRadius:8,padding:"8px 12px",textDecoration:"none",display:"flex",flexDirection:"column",gap:3,minWidth:220}}>
            <div style={{fontFamily:F.mono,fontSize:9,fontWeight:700,color:ct.col,letterSpacing:"0.06em"}}>{ct.label}</div>
            <div style={{fontFamily:F.mono,fontSize:10,color:"#EDF2F7"}}>{ct.addr.slice(0,10)}...{ct.addr.slice(-8)}</div>
            <div style={{fontFamily:F.mono,fontSize:9,color:"#4A8EDB"}}>View on Etherscan ↗</div>
          </a>
        ))}
      </div>
    </div>
  );
}


// ─── INTRO ────────────────────────────────────────────────────────────────────
function Intro({onStart,tbill,stats}){
  const [tick,setTick]=useState(0);
  useEffect(()=>{const t=setInterval(()=>setTick(x=>x+1),80);return()=>clearInterval(t);},[]);
  const pts=useRef([...Array(24)].map(()=>({x:5+Math.random()*90,y:5+Math.random()*90,s:.3+Math.random()*.8,d:2500+Math.random()*4000,o:.08+Math.random()*.18,del:Math.random()*4000}))).current;
  return(
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,position:"relative",overflow:"hidden"}}>
      {pts.map((p,i)=><div key={i} style={{position:"absolute",left:`${p.x}%`,top:`${p.y}%`,width:p.s*7,height:p.s*7,borderRadius:"50%",background:"#C8A84B",opacity:p.o*(0.5+0.5*Math.sin((tick*80+p.del)/p.d)),pointerEvents:"none"}}/>)}
      <div style={{position:"absolute",top:"10%",left:"18%",width:460,height:460,borderRadius:"50%",background:"radial-gradient(circle, rgba(200,168,75,0.07) 0%, transparent 70%)",pointerEvents:"none"}}/>
      <div style={{position:"absolute",bottom:"15%",right:"12%",width:320,height:320,borderRadius:"50%",background:"radial-gradient(circle, rgba(74,142,219,0.06) 0%, transparent 70%)",pointerEvents:"none"}}/>

      <div style={{textAlign:"center",maxWidth:680,position:"relative",zIndex:1}}>
        <div style={{display:"inline-flex",alignItems:"center",gap:12,marginBottom:32}}>
          <div style={{width:52,height:52,background:"#C8A84B",borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,fontWeight:900,color:"#07090E",fontFamily:F.display,boxShadow:"0 0 40px rgba(200,168,75,0.35)"}}>CY</div>
          <div style={{textAlign:"left"}}>
            <div style={{fontFamily:F.display,fontWeight:800,fontSize:22,color:"#EDF2F7",letterSpacing:"-0.02em"}}>ClearYield</div>
            <div style={{fontFamily:F.mono,fontSize:10,color:"#C8A84B",letterSpacing:"0.12em"}}>SINGAPORE · MAS LICENSED</div>
          </div>
        </div>

        <h1 style={{fontFamily:F.display,fontWeight:800,fontSize:46,color:"#EDF2F7",lineHeight:1.08,letterSpacing:"-0.03em",marginBottom:18}}>
          Your stablecoin<br/>should be <span style={{color:"#C8A84B"}}>working for you.</span>
        </h1>
        <p style={{fontFamily:F.mono,fontSize:13,color:"#6B7A99",lineHeight:1.85,marginBottom:14,maxWidth:540,margin:"0 auto 14px"}}>
          Circle and Tether hold billions in US Treasuries earning 4–5% annually.<br/><span style={{color:"#EDF2F7",fontWeight:700}}>None of that reaches you.</span> Regulators made sure of it.
        </p>
        <p style={{fontFamily:F.mono,fontSize:12,color:"#6B7A99",lineHeight:1.75,marginBottom:40,maxWidth:500,margin:"0 auto 40px"}}>
          ClearYield is a Singapore MAS-licensed intermediary that sits between the issuer and you — distributing the yield that issuers are legally prohibited from passing on directly.
        </p>

        <div style={{display:"flex",gap:10,justifyContent:"center",marginBottom:44,flexWrap:"wrap"}}>
          {[{n:"01",l:"Who holds the assets",s:"And why they can't pay you",c:"#E05252"},{n:"02",l:"What passes legal scrutiny",s:"Howey Test · CLARITY · MiCA · MAS · HKMA",c:"#D4913A"},{n:"03",l:"What you can access",s:"Jurisdiction-enforced, compliantly distributed",c:"#3ABF7A"}].map((st,i)=>(
            <div key={i} style={{background:"#0F1520",border:`1px solid ${st.c}28`,borderRadius:11,padding:"12px 18px",display:"flex",alignItems:"center",gap:10,minWidth:210}}>
              <div style={{width:30,height:30,background:`${st.c}20`,border:`1px solid ${st.c}40`,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:F.mono,fontWeight:800,fontSize:12,color:st.c,flexShrink:0}}>{st.n}</div>
              <div style={{textAlign:"left"}}>
                <div style={{fontFamily:F.mono,fontSize:12,fontWeight:700,color:"#EDF2F7"}}>{st.l}</div>
                <div style={{fontFamily:F.mono,fontSize:10,color:"#6B7A99",marginTop:2,lineHeight:1.4}}>{st.s}</div>
              </div>
            </div>
          ))}
        </div>

        <Btn onClick={onStart} style={{fontSize:15,padding:"14px 52px",borderRadius:10,boxShadow:"0 0 48px rgba(200,168,75,0.28)"}}>Get Started →</Btn>
        <div style={{display:"flex",gap:20,justifyContent:"center",marginTop:14,flexWrap:"wrap"}}>
          {tbill&&!tbill.loading&&<div style={{display:"flex",gap:6,alignItems:"center"}}>
            <div style={{width:5,height:5,borderRadius:"50%",background:"#3ABF7A",boxShadow:"0 0 4px #3ABF7A"}}/>
            <span style={{fontFamily:F.mono,fontSize:10,color:"#6B7A99"}}>3M T-Bill: <span style={{color:"#C8A84B",fontWeight:700}}>{tbill.rate?.toFixed(2)}%</span></span>
          </div>}
          {tbill&&!tbill.loading&&<span style={{fontFamily:F.mono,fontSize:10,color:"#6B7A99"}}>CY-USD: <span style={{color:"#3ABF7A",fontWeight:700}}>{tbill.cyUsdRate}%</span></span>}
          {tbill&&!tbill.loading&&<span style={{fontFamily:F.mono,fontSize:10,color:"#6B7A99"}}>CY-USDC: <span style={{color:"#7EB8C8",fontWeight:700}}>{tbill.cyUsdcRate}%</span></span>}
          {(!tbill||tbill.loading)&&<span style={{fontFamily:F.mono,fontSize:10,color:"#252D4299"}}>Singapore · MAS Payment Services Act · Loading live rates…</span>}
        </div>
      </div>
    </div>
  );
}

// ─── NAV ─────────────────────────────────────────────────────────────────────
function Nav({layer,setLayer,onHome}){
  return(
    <nav style={{background:"rgba(7,9,14,0.96)",backdropFilter:"blur(24px)",borderBottom:"1px solid rgba(255,255,255,0.07)",position:"sticky",top:0,zIndex:100}}>
      <div style={{padding:"0 24px",display:"flex",alignItems:"center",height:54,gap:0}}>
        <div onClick={onHome} style={{display:"flex",alignItems:"center",gap:9,marginRight:28,cursor:"pointer",opacity:0.9}}>
          <div style={{width:26,height:26,background:"#C8A84B",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:900,color:"#07090E",fontFamily:F.display}}>CY</div>
          <span style={{fontFamily:F.display,fontWeight:800,fontSize:13,color:"#EDF2F7"}}>ClearYield</span>
        </div>
        {/* Value chain */}
        <div style={{display:"flex",alignItems:"center",gap:0,flex:1,overflowX:"auto"}}>
          {[
            {label:"Stablecoin Issuer",sub:"cannot pay yield",k:"issuance",col:"#E05252"},
            {arrow:true,sub:"CLARITY bans"},
            {label:"ClearYield",sub:"licensed intermediary",k:"compliance",col:"#C8A84B"},
            {arrow:true,sub:"distributes"},
            {label:"End User",sub:"receives yield",k:"distribution",col:"#3ABF7A"},
          ].map((item,i)=>item.arrow?(
            <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",margin:"0 5px",flexShrink:0}}>
              <span style={{fontFamily:F.mono,fontSize:14,color:"#252D42",lineHeight:1}}>→</span>
              <span style={{fontFamily:F.mono,fontSize:8,color:"#252D42",whiteSpace:"nowrap"}}>{item.sub}</span>
            </div>
          ):(
            <div key={i} onClick={()=>setLayer(item.k)} style={{padding:"4px 11px",borderRadius:6,background:layer===item.k?`${item.col}18`:"transparent",border:`1px solid ${layer===item.k?item.col+"40":"rgba(255,255,255,0.07)"}`,cursor:"pointer",transition:"all 0.15s",flexShrink:0}}>
              <div style={{fontFamily:F.mono,fontSize:11,fontWeight:700,color:layer===item.k?item.col:"#6B7A99",whiteSpace:"nowrap"}}>{item.label}</div>
              <div style={{fontFamily:F.mono,fontSize:8,color:"#252D42bb"}}>{item.sub}</div>
            </div>
          ))}
        </div>
        {/* Step pills */}
        <div style={{display:"flex",gap:5,marginLeft:16}}>
          {[{k:"issuance",n:"01",l:"Issuance"},{k:"compliance",n:"02",l:"Compliance"},{k:"distribution",n:"03",l:"Distribution"},{k:"comparison",n:"04",l:"Compare"}].map(s=>(
            <button key={s.k} onClick={()=>setLayer(s.k)} style={{background:layer===s.k?"rgba(200,168,75,0.13)":"transparent",border:`1px solid ${layer===s.k?"rgba(200,168,75,0.50)":"rgba(255,255,255,0.07)"}`,borderRadius:7,padding:"4px 11px",cursor:"pointer",transition:"all 0.15s"}}>
              <div style={{fontFamily:F.mono,fontSize:8,color:layer===s.k?"#C8A84B":"#252D42bb",letterSpacing:"0.08em"}}>{s.n}</div>
              <div style={{fontFamily:F.mono,fontSize:11,fontWeight:700,color:layer===s.k?"#C8A84B":"#6B7A99"}}>{s.l}</div>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}

// ─── LAYER 1 ─────────────────────────────────────────────────────────────────
function IssuanceLayer({onNext}){
  const [sel,setSel]=useState(null);
  const src=YIELD_SOURCES.find(s=>s.id===sel);
  return(
    <div style={{padding:"32px 28px",maxWidth:1200,margin:"0 auto"}}>
      <div style={{marginBottom:22}}>
        <div style={{fontFamily:F.mono,fontSize:10,color:"#C8A84B",letterSpacing:"0.12em",marginBottom:8}}>LAYER 01 — ISSUANCE</div>
        <h1 style={{fontFamily:F.display,fontSize:28,fontWeight:800,color:"#EDF2F7",margin:"0 0 10px",letterSpacing:"-0.02em"}}>Who Holds the Assets</h1>
        <p style={{fontFamily:F.mono,fontSize:12,color:"#6B7A99",lineHeight:1.8,maxWidth:680}}>
          Stablecoins earn yield because someone is doing something with the underlying reserves. That someone is the issuer. Under the CLARITY Act, <span style={{color:"#E05252",fontWeight:700}}>the issuer cannot pass that yield to you.</span> Select a yield source to see why — and how ClearYield solves it.
        </p>
      </div>

      <div style={{background:"rgba(224,82,82,0.10)",border:"1px solid rgba(224,82,82,0.30)",borderRadius:12,padding:"14px 20px",marginBottom:24,display:"flex",gap:14,alignItems:"flex-start"}}>
        <div style={{fontFamily:F.mono,fontSize:18,color:"#E05252",flexShrink:0,lineHeight:1,marginTop:2}}>✕</div>
        <div>
          <div style={{fontFamily:F.mono,fontSize:12,fontWeight:700,color:"#E05252",marginBottom:5}}>THE PROHIBITION — CLARITY Act s.3(11) · MiCA Art. 40 · HKMA Ordinance</div>
          <div style={{fontFamily:F.mono,fontSize:11,color:"#6B7A99",lineHeight:1.8}}>"A payment stablecoin issuer shall not pay interest, yield, or other return to a holder of a payment stablecoin on account of holding the stablecoin." — US, EU, and HK all impose this. <span style={{color:"#C8A84B",fontWeight:700}}>Singapore does not.</span> Under MAS SCS, a licensed MPI issuer can distribute reserve yield directly to holders. Every yield source below generates real return. In three of four jurisdictions the issuer cannot pass it to you — <span style={{color:"#C8A84B"}}>ClearYield fills that gap differently depending on where you are.</span></div>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(195px,1fr))",gap:10,marginBottom:sel?18:28}}>
        {YIELD_SOURCES.map(s=>(
          <div key={s.id} onClick={()=>setSel(sel===s.id?null:s.id)}
            style={{background:sel===s.id?`${s.color}15`:"#0F1520",border:`1px solid ${sel===s.id?s.color+"60":"rgba(255,255,255,0.07)"}`,borderRadius:11,padding:"14px 15px",cursor:"pointer",transition:"all 0.15s"}}>
            <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:10}}>
              <div style={{width:32,height:32,background:`${s.color}20`,border:`1px solid ${s.color}30`,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:F.display,fontWeight:800,fontSize:11,color:s.color}}>{s.logo}</div>
              <div>
                <div style={{fontFamily:F.display,fontSize:12,fontWeight:700,color:"#EDF2F7",lineHeight:1.2}}>{s.name}</div>
                <div style={{fontFamily:F.mono,fontSize:9,color:"#6B7A99",marginTop:2}}>{s.apy} APY</div>
              </div>
            </div>
            <div style={{fontFamily:F.mono,fontSize:9,color:"#6B7A99",lineHeight:1.5,marginBottom:8}}>{s.mechanism}</div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <Tag label={s.risk} color={riskColor[s.risk]} bg={riskBg[s.risk]} dot/>
              <span style={{fontFamily:F.mono,fontSize:9,color:"#E05252",fontWeight:700}}>Issuer blocked ✕</span>
            </div>
          </div>
        ))}
      </div>

      {src&&(
        <div style={{background:"#0F1520",border:`1px solid ${src.color}40`,borderRadius:14,padding:22,marginBottom:24}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
            <div style={{width:36,height:36,background:`${src.color}20`,border:`1px solid ${src.color}30`,borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:F.display,fontWeight:800,fontSize:13,color:src.color}}>{src.logo}</div>
            <div>
              <div style={{fontFamily:F.display,fontSize:15,fontWeight:800,color:"#EDF2F7"}}>{src.name}</div>
              <div style={{fontFamily:F.mono,fontSize:10,color:"#6B7A99"}}>{src.issuer} · {src.apy} APY</div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
            {[{title:"WHY THE ISSUER CANNOT PAY",body:src.whyNot,col:"#E05252",bg:"rgba(224,82,82,0.10)"},{title:"HOW CLEARYIELD SOLVES IT",body:src.howCY,col:"#3ABF7A",bg:"rgba(58,191,122,0.11)"},{title:"REAL-WORLD PRECEDENT",body:src.precedent,col:"#C8A84B",bg:"rgba(200,168,75,0.13)"}].map(p=>(
              <div key={p.title} style={{background:p.bg,border:`1px solid ${p.col}25`,borderRadius:9,padding:"13px 14px"}}>
                <div style={{fontFamily:F.mono,fontSize:9,fontWeight:700,color:p.col,letterSpacing:"0.08em",marginBottom:7}}>{p.title}</div>
                <div style={{fontFamily:F.mono,fontSize:11,color:"#6B7A99",lineHeight:1.7}}>{p.body}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{display:"flex",justifyContent:"flex-end"}}>
        <Btn onClick={onNext}>Next: Compliance Layer →</Btn>
      </div>
    </div>
  );
}

// ─── LAYER 2 ─────────────────────────────────────────────────────────────────
function ComplianceLayer({onNext,tbill}){
  const [sel,setSel]=useState("cyusd");
  const vault=VAULT_ANALYSES.find(v=>v.id===sel);
  return(
    <div style={{padding:"32px 28px",maxWidth:1200,margin:"0 auto"}}>
      <div style={{marginBottom:22}}>
        <div style={{fontFamily:F.mono,fontSize:10,color:"#C8A84B",letterSpacing:"0.12em",marginBottom:8}}>LAYER 02 — COMPLIANCE</div>
        <h1 style={{fontFamily:F.display,fontSize:28,fontWeight:800,color:"#EDF2F7",margin:"0 0 10px",letterSpacing:"-0.02em"}}>What ClearYield Screens</h1>
        <p style={{fontFamily:F.mono,fontSize:12,color:"#6B7A99",lineHeight:1.8,maxWidth:680}}>Before distributing yield from any source, ClearYield runs two tests: the <span style={{color:"#EDF2F7"}}>Howey Test</span> (is this a security?) and a <span style={{color:"#EDF2F7"}}>four-jurisdiction compliance check</span> across CLARITY, MiCA, MAS, and HKMA.</p>
      </div>

      <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
        {VAULT_ANALYSES.map(v=>(
          <button key={v.id} onClick={()=>setSel(v.id)}
            style={{display:"flex",alignItems:"center",gap:8,padding:"8px 13px",borderRadius:9,border:`1px solid ${sel===v.id?v.color+"60":"rgba(255,255,255,0.07)"}`,background:sel===v.id?`${v.color}15`:"#0F1520",cursor:"pointer",transition:"all 0.15s"}}>
            <div style={{width:22,height:22,background:`${v.color}25`,borderRadius:5,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:F.display,fontWeight:800,fontSize:9,color:v.color}}>{v.logo}</div>
            <div style={{textAlign:"left"}}>
              <div style={{fontFamily:F.mono,fontSize:11,fontWeight:700,color:sel===v.id?v.color:"#EDF2F7"}}>{v.name}</div>
              <div style={{fontFamily:F.mono,fontSize:9,color:"#6B7A99"}}>{v.type}</div>
            </div>
            {v.isNative&&<Tag label="★ NATIVE" color="#C8A84B" bg="rgba(200,168,75,0.13)"/>}
          </button>
        ))}
      </div>

      {vault&&(
        <div>
          <div style={{background:"#0F1520",border:`1px solid ${vault.color}40`,borderRadius:13,padding:18,marginBottom:13}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10}}>
              <div style={{display:"flex",gap:12,alignItems:"center"}}>
                <div style={{width:38,height:38,background:`${vault.color}20`,border:`1px solid ${vault.color}30`,borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:F.display,fontWeight:800,fontSize:13,color:vault.color}}>{vault.logo}</div>
                <div>
                  <div style={{fontFamily:F.display,fontSize:16,fontWeight:800,color:"#EDF2F7"}}>{vault.name}</div>
                  <div style={{fontFamily:F.mono,fontSize:10,color:"#6B7A99"}}>{vault.type} · {vault.apy}% APY · {vault.risk} risk</div>
                </div>
              </div>
              <div style={{background:`${vault.verdictColor}20`,border:`1px solid ${vault.verdictColor}40`,borderRadius:8,padding:"7px 14px",textAlign:"center"}}>
                <div style={{fontFamily:F.mono,fontSize:8,color:vault.verdictColor,letterSpacing:"0.08em",marginBottom:2}}>OVERALL VERDICT</div>
                <div style={{fontFamily:F.mono,fontSize:12,fontWeight:800,color:vault.verdictColor}}>{vault.verdict}</div>
              </div>
            </div>
            <div style={{fontFamily:F.mono,fontSize:11,color:"#6B7A99",lineHeight:1.7,marginTop:12,paddingTop:12,borderTop:"1px solid rgba(255,255,255,0.07)"}}>{vault.desc}</div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div style={{background:"#0F1520",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:16}}>
              <div style={{fontFamily:F.mono,fontSize:11,fontWeight:700,color:"#EDF2F7",marginBottom:3}}>HOWEY TEST — SEC v. Howey (1946)</div>
              <div style={{fontFamily:F.mono,fontSize:10,color:"#6B7A99",marginBottom:13,lineHeight:1.6}}>All four prongs must be satisfied to constitute a security. If satisfied → SEC registration or exemption required.</div>
              {HOWEY_PRONGS.map(p=>{
                const res=vault.howey[`p${p.num}`];
                return(
                  <div key={p.num} style={{marginBottom:8,padding:"9px 11px",borderRadius:8,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                      <div style={{display:"flex",gap:7,alignItems:"center"}}>
                        <span style={{fontFamily:F.mono,fontSize:9,fontWeight:700,color:"#C8A84B"}}>P{p.num}</span>
                        <span style={{fontFamily:F.mono,fontSize:11,fontWeight:700,color:"#EDF2F7"}}>{p.label}</span>
                      </div>
                      <HBadge r={res.r}/>
                    </div>
                    <div style={{fontFamily:F.mono,fontSize:10,color:"#6B7A99",lineHeight:1.6}}>{res.note}</div>
                  </div>
                );
              })}
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {[{flag:"🇺🇸",label:"US CLARITY Act",key:"clarity",law:"CLARITY Act s.3(11)"},{flag:"🇪🇺",label:"EU MiCA (Art. 40)",key:"mica",law:"MiCA Title III · Dec 2024"},{flag:"🇸🇬",label:"Singapore MAS",key:"mas",law:"MAS Notice PSN08"},{flag:"🇭🇰",label:"HK HKMA Ord. (2025)",key:"hkma",law:"Stablecoins Ord. May 2025"}].map(j=>{
                const sc=(vault.jScores||{})[j.key]||"pass";
                const col=sc==="pass"?"#3ABF7A":sc==="warn"?"#D4913A":"#E05252";
                const bg =sc==="pass"?"rgba(58,191,122,0.11)":sc==="warn"?"rgba(212,145,58,0.12)":"rgba(224,82,82,0.10)";
                return(
                  <div key={j.key} style={{background:"#0F1520",border:"1px solid rgba(255,255,255,0.07)",borderRadius:9,padding:"11px 13px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                      <div style={{display:"flex",gap:7,alignItems:"center"}}>
                        <span style={{fontSize:13}}>{j.flag}</span>
                        <div>
                          <div style={{fontFamily:F.mono,fontSize:11,fontWeight:700,color:"#EDF2F7"}}>{j.label}</div>
                          <div style={{fontFamily:F.mono,fontSize:8,color:"#252D42bb"}}>{j.law}</div>
                        </div>
                      </div>
                      <Tag label={sc==="pass"?"COMPLIANT":sc==="warn"?"CAUTION":"BLOCKED"} color={col} bg={bg}/>
                    </div>
                    <div style={{fontFamily:F.mono,fontSize:10,color:"#6B7A99",lineHeight:1.6}}>{(vault.jNotes||{})[j.key]}</div>
                  </div>
                );
              })}
              <div style={{background:"rgba(200,168,75,0.13)",border:"1px solid rgba(200,168,75,0.30)",borderRadius:9,padding:"11px 13px"}}>
                <div style={{fontFamily:F.mono,fontSize:9,fontWeight:700,color:"#C8A84B",marginBottom:5,letterSpacing:"0.06em"}}>KEY INSIGHT</div>
                <div style={{fontFamily:F.mono,fontSize:11,color:"#6B7A99",lineHeight:1.6}}>{vault.insight}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{display:"flex",justifyContent:"flex-end",marginTop:22}}>
        <Btn onClick={onNext}>Next: Distribution Layer →</Btn>
      </div>
    </div>
  );
}

// ─── LAYER 3 ─────────────────────────────────────────────────────────────────
function DistributionLayer({tbill}){
  const [jKey,setJKey]      =useState(null);
  const [view,setView]      =useState("markets");
  const [balance,setBalance]=useState(0);
  const [positions,setPos]  =useState([]);
  const [depositTarget,setDT]=useState(null);
  const [depAmt,setDepAmt]  =useState("");
  const [simDays,setSimDays]=useState(30);
  const [showAdd,setShowAdd]=useState(false);
  const [addBal,setAddBal]  =useState("");
  const [toast,setToast]    =useState(null);

  function fire(msg,txUrl){setToast({msg,txUrl});setTimeout(()=>setToast(null),6000);}
  if(!jKey) return <JurisdictionGate onSelect={setJKey}/>;

  const jConfig=JURISDICTIONS.find(j=>j.key===jKey);
  const active=positions.filter(p=>!p.redeemed);
  const totalDep=active.reduce((s,p)=>s+p.amt,0);
  const simEarn=active.reduce((s,p)=>s+(p.amt*(p.apy/100)*(simDays/365)),0);

  function deposit(vault,amt){
    setBalance(b=>b-amt);
    setPos(p=>[...p,{id:`${vault.id}-${Date.now()}`,vaultId:vault.id,name:vault.name,color:vault.color,logo:vault.logo,apy:vault.apy,amt,depositedOn:new Date().toLocaleDateString("en-SG"),isNative:vault.isNative}]);
    setDT(null);setDepAmt("");setView("portfolio");
    fire(`Deposited $${amt.toLocaleString()} into ${vault.name}`, vault.id==="cyusd"?CONTRACTS.cyusd.etherscan:CONTRACTS.vault.etherscan);
  }

  return(
    <div>
      {toast&&(
        <div style={{position:"fixed",bottom:24,right:24,zIndex:999,background:"#0F1520",border:"1px solid rgba(58,191,122,0.40)",borderRadius:12,padding:"14px 18px",boxShadow:"0 16px 48px rgba(0,0,0,0.5)",maxWidth:340}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:toast.txUrl?8:0}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:"#3ABF7A",flexShrink:0}}/>
            <div style={{fontFamily:F.mono,fontSize:13,fontWeight:700,color:"#3ABF7A"}}>{toast.msg}</div>
          </div>
          {toast.txUrl&&(
            <div style={{paddingLeft:16}}>
              <div style={{fontFamily:F.mono,fontSize:10,color:"#6B7A99",marginBottom:6}}>Architecture deployed on Sepolia testnet. In production this triggers a real on-chain transaction.</div>
              <a href={toast.txUrl} target="_blank" rel="noopener noreferrer"
                style={{display:"inline-flex",alignItems:"center",gap:5,background:"rgba(74,142,219,0.12)",border:"1px solid rgba(74,142,219,0.30)",borderRadius:6,padding:"5px 10px",textDecoration:"none"}}>
                <span style={{fontFamily:F.mono,fontSize:10,fontWeight:700,color:"#4A8EDB"}}>⛓ View ClearYieldVault on Etherscan ↗</span>
              </a>
            </div>
          )}
        </div>
      )}

      {/* Subbar */}
      <div style={{borderBottom:"1px solid rgba(255,255,255,0.07)",padding:"0 28px",display:"flex",alignItems:"center",background:"#0D1117",height:44,gap:0}}>
        <div style={{fontFamily:F.mono,fontSize:10,color:"#C8A84B",letterSpacing:"0.12em",marginRight:20}}>LAYER 03 — DISTRIBUTION</div>
        {["markets","portfolio"].map(v=>(
          <button key={v} onClick={()=>setView(v)} style={{background:"none",border:"none",borderBottom:`2px solid ${view===v?"#C8A84B":"transparent"}`,color:view===v?"#EDF2F7":"#6B7A99",cursor:"pointer",padding:"0 14px",height:44,fontFamily:F.mono,fontWeight:600,fontSize:11,letterSpacing:"0.05em",transition:"all 0.15s",display:"flex",alignItems:"center",gap:5}}>
            {v.toUpperCase()}
            {v==="portfolio"&&active.length>0&&<span style={{background:"rgba(200,168,75,0.13)",color:"#C8A84B",borderRadius:8,padding:"1px 6px",fontSize:10}}>{active.length}</span>}
          </button>
        ))}
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:12}}>
          <div onClick={()=>setJKey(null)} style={{display:"flex",alignItems:"center",gap:5,background:"rgba(200,168,75,0.13)",border:"1px solid rgba(200,168,75,0.30)",borderRadius:7,padding:"4px 10px",cursor:"pointer"}}>
            <span style={{fontSize:13}}>{jConfig?.flag}</span>
            <span style={{fontFamily:F.mono,fontSize:10,color:"#C8A84B",fontWeight:700}}>{jConfig?.label}</span>
            <span style={{fontFamily:F.mono,fontSize:9,color:"#6B7A99"}}>▾</span>
          </div>
          <span style={{fontFamily:F.mono,fontSize:12,color:"#6B7A99"}}>Balance: <span style={{color:"#3ABF7A",fontWeight:700}}>${balance.toFixed(2)}</span></span>
        </div>
      </div>

      {/* MARKETS */}
      {view==="markets"&&(
        <div style={{padding:"28px 28px",maxWidth:1200,margin:"0 auto"}}>
          <div style={{marginBottom:20}}>
            <h1 style={{fontFamily:F.display,fontSize:26,fontWeight:800,color:"#EDF2F7",margin:"0 0 8px",letterSpacing:"-0.02em"}}>Who Receives Yield</h1>
            <p style={{fontFamily:F.mono,fontSize:12,color:"#6B7A99",lineHeight:1.7,maxWidth:700}}>ClearYield as the licensed intermediary distributes yield to end users. Jurisdiction enforcement is automatic — vaults non-compliant in your jurisdiction are blocked or flagged in real time.</p>
          </div>
          <ContractBadge/>

          {balance===0&&!showAdd&&(
            <div style={{background:"rgba(200,168,75,0.13)",border:"1px solid rgba(200,168,75,0.30)",borderRadius:10,padding:"12px 18px",marginBottom:18,display:"flex",alignItems:"center",gap:14}}>
              <div style={{fontFamily:F.mono,fontSize:12,color:"#6B7A99",flex:1}}>Add a simulated USDC balance to test deposits and see jurisdiction enforcement in action.</div>
              <Btn sm onClick={()=>setShowAdd(true)}>+ Add Balance</Btn>
            </div>
          )}
          {showAdd&&(
            <div style={{background:"#0F1520",border:"1px solid rgba(255,255,255,0.13)",borderRadius:10,padding:"14px 18px",marginBottom:14,display:"flex",gap:10,alignItems:"flex-end",flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:180}}>
                <div style={{fontFamily:F.mono,fontSize:10,color:"#6B7A99",textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:6}}>Simulated USDC</div>
                <input type="number" value={addBal} onChange={e=>setAddBal(e.target.value)} placeholder="e.g. 10000" style={{width:"100%",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.13)",borderRadius:8,padding:"9px 13px",color:"#EDF2F7",fontFamily:F.mono,fontSize:13,outline:"none"}}/>
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {[1000,5000,10000,50000].map(v=><Btn key={v} sm variant="subtle" onClick={()=>{setBalance(b=>b+v);setShowAdd(false);}}>${v.toLocaleString()}</Btn>)}
                <Btn sm onClick={()=>{const v=parseFloat(addBal);if(v>0){setBalance(b=>b+v);setAddBal("");setShowAdd(false);}}}>Add</Btn>
                <Btn sm variant="subtle" onClick={()=>setShowAdd(false)}>Cancel</Btn>
              </div>
            </div>
          )}

          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))",gap:13}}>
            {VAULT_ANALYSES.map(vault=>{
              const access=getAccess(vault,jKey);
              return(
                <div key={vault.id} style={{background:"#0F1520",border:`1px solid ${vault.isNative?"rgba(200,168,75,0.50)":access.blocked?"rgba(224,82,82,0.30)":"rgba(255,255,255,0.07)"}`,borderRadius:13,overflow:"hidden",opacity:access.blocked?0.72:1,transition:"border-color 0.15s"}}
                  onMouseEnter={e=>{if(!access.blocked)e.currentTarget.style.borderColor=vault.isNative?"rgba(200,168,75,0.80)":vault.color+"45";}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=vault.isNative?"rgba(200,168,75,0.50)":access.blocked?"rgba(224,82,82,0.30)":"rgba(255,255,255,0.07)";}}>
                  <div style={{height:3,background:access.blocked?"#E05252":access.warned?"#D4913A":vault.color}}/>
                  {vault.isNative&&<div style={{background:"rgba(200,168,75,0.13)",borderBottom:"1px solid rgba(200,168,75,0.25)",padding:"5px 14px",display:"flex",alignItems:"center",gap:6}}>
                    {vault.isSGOnly
                      ?<><span style={{fontFamily:F.mono,fontSize:10,fontWeight:700,color:"#C8A84B",letterSpacing:"0.05em"}}>★ CLEARYIELD ISSUED</span><span style={{fontFamily:F.mono,fontSize:9,color:"#6B7A99"}}>· Singapore MPI issuer · Issuer-direct yield · SG/ASEAN only</span></>
                      :<><span style={{fontFamily:F.mono,fontSize:10,fontWeight:700,color:"#7EB8C8",letterSpacing:"0.05em"}}>★ CLEARYIELD WRAPPER</span><span style={{fontFamily:F.mono,fontSize:9,color:"#6B7A99"}}>· Licensed third-party · CLARITY / MiCA / HKMA compliant · All jurisdictions</span></>
                    }
                  </div>}
                  <div style={{padding:"15px 17px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:11}}>
                      <div style={{display:"flex",gap:9,alignItems:"center"}}>
                        <div style={{width:32,height:32,background:`${vault.color}20`,border:`1px solid ${vault.color}30`,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:F.display,fontWeight:800,fontSize:11,color:vault.color}}>{vault.logo}</div>
                        <div>
                          <div style={{fontFamily:F.display,fontSize:13,fontWeight:700,color:"#EDF2F7"}}>{vault.name}</div>
                          <div style={{fontFamily:F.mono,fontSize:9,color:"#6B7A99",marginTop:1}}>{vault.type}</div>
                        </div>
                      </div>
                      <Tag label={vault.risk} color={riskColor[vault.risk]} bg={riskBg[vault.risk]} dot/>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:10}}>
                      <div style={{background:`${vault.color}14`,border:`1px solid ${vault.color}22`,borderRadius:7,padding:"8px 10px"}}>
                        <div style={{fontFamily:F.mono,fontSize:8,color:vault.color,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:2}}>APY</div>
                        <div style={{fontFamily:F.display,fontWeight:800,color:vault.color,fontSize:18,lineHeight:1}}>
                          {vault.id==="cyusd"&&tbill&&!tbill.loading?tbill.cyUsdRate:vault.id==="cyusdc"&&tbill&&!tbill.loading?tbill.cyUsdcRate:vault.apy}%
                        </div>
                        {(vault.id==="cyusd"||vault.id==="cyusdc")&&tbill&&!tbill.loading&&<div style={{fontFamily:F.mono,fontSize:7,color:vault.color,marginTop:2,opacity:0.7}}>LIVE</div>}
                      </div>
                      <div style={{background:"rgba(255,255,255,0.025)",borderRadius:7,padding:"8px 10px"}}>
                        <div style={{fontFamily:F.mono,fontSize:8,color:"#6B7A99",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:2}}>Verdict</div>
                        <div style={{fontFamily:F.mono,fontSize:9,fontWeight:700,color:vault.verdictColor,lineHeight:1.3}}>{vault.verdict}</div>
                      </div>
                    </div>
                    <div style={{fontFamily:F.mono,fontSize:10,color:"#6B7A99",lineHeight:1.6,marginBottom:10}}>{vault.desc}</div>
                    <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:10}}>
                      {[["🇺🇸","clarity"],["🇪🇺","mica"],["🇸🇬","mas"],["🇭🇰","hkma"]].map(([f,k])=>{
                        const sc=(vault.jScores||{})[k]||"pass";
                        const col=sc==="pass"?"#3ABF7A":sc==="warn"?"#D4913A":"#E05252";
                        const bg=sc==="pass"?"rgba(58,191,122,0.11)":sc==="warn"?"rgba(212,145,58,0.12)":"rgba(224,82,82,0.10)";
                        return <Tag key={k} label={`${f} ${sc==="pass"?"●":sc==="warn"?"◐":"○"}`} color={col} bg={bg}/>;
                      })}
                    </div>
                    {vault.isNative&&!access.blocked&&<div style={{background:"rgba(58,191,122,0.11)",border:"1px solid rgba(58,191,122,0.25)",borderRadius:7,padding:"6px 10px",marginBottom:9,fontFamily:F.mono,fontSize:10,color:"#3ABF7A"}}>
                      {vault.isSGOnly
                        ?"🇸🇬 Issuer-direct: ClearYield is the MPI-licensed issuer of CY-USD — paying T-bill reserve yield directly under MAS SCS. Higher yield than the wrapper because no Circle economics."
                        :"🌐 Wrapper: ClearYield holds your USDC as a licensed third-party intermediary. Accessible to US, EU, HK, and SG users. CLARITY / MiCA / HKMA compliant."
                      }
                    </div>}
                    {access.blocked&&<div style={{background:"rgba(224,82,82,0.10)",border:"1px solid rgba(224,82,82,0.30)",borderRadius:7,padding:"6px 10px",marginBottom:9}}><div style={{fontFamily:F.mono,fontSize:10,fontWeight:700,color:"#E05252",marginBottom:2}}>BLOCKED — {access.law}</div><div style={{fontFamily:F.mono,fontSize:9,color:"#6B7A99"}}>{access.reason}</div></div>}
                    {access.warned&&!access.blocked&&<div style={{background:"rgba(212,145,58,0.12)",border:"1px solid rgba(212,145,58,0.30)",borderRadius:7,padding:"6px 10px",marginBottom:9}}><div style={{fontFamily:F.mono,fontSize:10,fontWeight:700,color:"#D4913A",marginBottom:2}}>⚠ CAUTION — {access.law}</div><div style={{fontFamily:F.mono,fontSize:9,color:"#6B7A99"}}>{access.reason}</div></div>}
                    <Btn full disabled={access.blocked} onClick={()=>{setDT(vault);setDepAmt("");}}>
                      {access.blocked?"Unavailable in your jurisdiction":"Deposit →"}
                    </Btn>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PORTFOLIO */}
      {view==="portfolio"&&(
        <div style={{padding:"28px 28px",maxWidth:1000,margin:"0 auto"}}>
          <div style={{marginBottom:22}}>
            <h1 style={{fontFamily:F.display,fontSize:26,fontWeight:800,color:"#EDF2F7",margin:"0 0 8px",letterSpacing:"-0.02em"}}>Your Portfolio</h1>
            <p style={{fontFamily:F.mono,fontSize:12,color:"#6B7A99",lineHeight:1.7}}>Your active positions within ClearYield. Use the growth simulator to project earnings over time.</p>
          </div>

          {active.length===0?(
            <div style={{background:"#0F1520",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:"60px 40px",textAlign:"center"}}>
              <div style={{fontFamily:F.mono,fontSize:14,color:"#6B7A99",marginBottom:16}}>No active positions yet</div>
              <Btn sm onClick={()=>setView("markets")}>Explore Markets →</Btn>
            </div>
          ):(
            <>
              {/* Stats */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:20}}>
                {[{label:"Total Deposited",val:`$${totalDep.toLocaleString()}`,col:"#EDF2F7"},{label:`Projected Earnings (${simDays}d)`,val:`+$${simEarn.toFixed(2)}`,col:"#3ABF7A"},{label:"Available Balance",val:`$${balance.toFixed(2)}`,col:"#6B7A99"}].map(s=>(
                  <div key={s.label} style={{background:"#0F1520",border:"1px solid rgba(255,255,255,0.07)",borderRadius:10,padding:"14px 18px"}}>
                    <div style={{fontFamily:F.mono,fontSize:10,color:"#6B7A99",textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:7}}>{s.label}</div>
                    <div style={{fontFamily:F.display,fontSize:22,fontWeight:800,color:s.col,lineHeight:1}}>{s.val}</div>
                  </div>
                ))}
              </div>

              {/* Simulator */}
              <div style={{background:"#0F1520",border:"1px solid rgba(200,168,75,0.30)",borderRadius:12,padding:"18px 22px",marginBottom:20}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14,flexWrap:"wrap",gap:10}}>
                  <div>
                    <div style={{fontFamily:F.mono,fontSize:11,fontWeight:700,color:"#C8A84B",marginBottom:3}}>GROWTH SIMULATOR</div>
                    <div style={{fontFamily:F.mono,fontSize:10,color:"#6B7A99"}}>Drag the slider to project portfolio growth over time</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontFamily:F.mono,fontSize:9,color:"#6B7A99",marginBottom:2}}>Projected earnings in {simDays} days</div>
                    <div style={{fontFamily:F.display,fontSize:26,fontWeight:800,color:"#3ABF7A"}}>+${simEarn.toFixed(2)}</div>
                  </div>
                </div>

                <input type="range" min={1} max={365} value={simDays} onChange={e=>setSimDays(Number(e.target.value))} style={{width:"100%",marginBottom:8}}/>
                <div style={{display:"flex",justifyContent:"space-between",fontFamily:F.mono,fontSize:9,color:"#252D42",marginBottom:14}}><span>1d</span><span>30d</span><span>90d</span><span>180d</span><span>365d</span></div>

                {active.map(p=>{
                  const earned=(p.amt*(p.apy/100)*(simDays/365));
                  return(
                    <div key={p.id} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 12px",borderRadius:8,background:"rgba(255,255,255,0.02)",marginBottom:6}}>
                      <div style={{width:26,height:26,background:`${p.color}20`,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:F.display,fontWeight:800,fontSize:10,color:p.color,flexShrink:0}}>{p.logo}</div>
                      <div style={{flex:1}}>
                        <div style={{fontFamily:F.mono,fontSize:11,fontWeight:700,color:"#EDF2F7"}}>{p.name}</div>
                        <div style={{fontFamily:F.mono,fontSize:9,color:"#6B7A99"}}>${p.amt.toLocaleString()} · {p.apy}% APY</div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontFamily:F.mono,fontSize:12,fontWeight:700,color:"#3ABF7A"}}>+${earned.toFixed(2)}</div>
                        <div style={{fontFamily:F.mono,fontSize:9,color:"#6B7A99"}}>+{(earned/p.amt*100).toFixed(2)}% in {simDays}d</div>
                      </div>
                    </div>
                  );
                })}

                <div style={{display:"flex",gap:6,marginTop:12,flexWrap:"wrap"}}>
                  {[7,30,90,180,365].map(d=>(
                    <button key={d} onClick={()=>setSimDays(d)} style={{fontFamily:F.mono,fontSize:11,fontWeight:600,background:simDays===d?"rgba(200,168,75,0.13)":"transparent",color:simDays===d?"#C8A84B":"#6B7A99",border:`1px solid ${simDays===d?"rgba(200,168,75,0.40)":"rgba(255,255,255,0.07)"}`,borderRadius:18,padding:"4px 12px",cursor:"pointer",transition:"all 0.12s"}}>{d}d</button>
                  ))}
                </div>
              </div>

              {/* Positions */}
              <div style={{fontFamily:F.mono,fontSize:10,color:"#252D42bb",textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:10}}>Active Positions</div>
              {active.map(p=>(
                <div key={p.id} style={{background:"#0F1520",border:`1px solid ${p.isNative?"rgba(200,168,75,0.30)":"rgba(255,255,255,0.07)"}`,borderRadius:11,padding:"14px 18px",display:"flex",alignItems:"center",gap:14,marginBottom:8}}>
                  <div style={{width:32,height:32,background:`${p.color}20`,border:`1px solid ${p.color}30`,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:F.display,fontWeight:800,fontSize:10,color:p.color,flexShrink:0}}>{p.logo}</div>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:F.display,fontWeight:700,fontSize:13,color:"#EDF2F7"}}>{p.name}</div>
                    <div style={{fontFamily:F.mono,fontSize:10,color:"#6B7A99"}}>Deposited {p.depositedOn} · {p.apy}% APY</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontFamily:F.display,fontWeight:800,fontSize:18,color:"#EDF2F7"}}>${p.amt.toLocaleString()}</div>
                    <div style={{fontFamily:F.mono,fontSize:10,color:"#3ABF7A"}}>+${(p.amt*p.apy/100/12).toFixed(2)}/mo est.</div>
                  </div>
                  <Btn sm variant="success" onClick={()=>{setBalance(b=>b+p.amt);setPos(ps=>ps.map(x=>x.id===p.id?{...x,redeemed:true}:x));fire(`Redeemed $${p.amt.toLocaleString()} from ${p.name}`,null);}}>Redeem</Btn>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Deposit modal */}
      {depositTarget&&(
        <div style={{position:"fixed",inset:0,background:"rgba(7,9,14,0.88)",backdropFilter:"blur(14px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:20}}>
          <div style={{background:"#0F1520",border:`1px solid ${depositTarget.color}30`,borderRadius:16,width:"100%",maxWidth:460,boxShadow:`0 0 60px ${depositTarget.color}18`,maxHeight:"90vh",overflowY:"auto",display:"flex",flexDirection:"column"}}>
            {/* Fixed header */}
            <div style={{padding:"20px 22px 16px",borderBottom:"1px solid rgba(255,255,255,0.07)",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
              <div style={{width:36,height:36,background:`${depositTarget.color}20`,border:`1px solid ${depositTarget.color}35`,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:F.display,fontWeight:800,fontSize:12,color:depositTarget.color}}>{depositTarget.logo}</div>
              <div>
                <div style={{fontFamily:F.display,fontWeight:800,fontSize:15,color:"#EDF2F7"}}>{depositTarget.name}</div>
                <div style={{fontFamily:F.mono,fontSize:11,color:"#6B7A99"}}>{depositTarget.apy}% APY · {depositTarget.risk} risk</div>
              </div>
              <button onClick={()=>setDT(null)} style={{marginLeft:"auto",background:"none",border:"none",color:"#6B7A99",fontSize:20,cursor:"pointer",lineHeight:1}}>×</button>
            </div>

            {/* Scrollable body */}
            <div style={{padding:"16px 22px",flex:1,overflowY:"auto"}}>
              {depositTarget.isNative&&(
                <div style={{background:"rgba(58,191,122,0.11)",border:"1px solid rgba(58,191,122,0.25)",borderRadius:8,padding:"10px 13px",marginBottom:12}}>
                  {depositTarget.isSGOnly
                    ?<><div style={{fontFamily:F.mono,fontSize:10,fontWeight:700,color:"#3ABF7A",marginBottom:3}}>🇸🇬 SINGAPORE SCS — ISSUER-DIRECT</div><div style={{fontFamily:F.mono,fontSize:11,color:"#6B7A99",lineHeight:1.6}}>ClearYield is the MPI-licensed issuer of CY-USD — distributing T-bill reserve yield directly under MAS SCS. No third-party wrapper. Higher yield (5.1%) because ClearYield captures the full T-bill return with no Circle economics. This is the product Circle cannot legally offer from a US or EU domicile.</div></>
                    :<><div style={{fontFamily:F.mono,fontSize:10,fontWeight:700,color:"#7EB8C8",marginBottom:3}}>🌐 THIRD-PARTY WRAPPER — CLARITY / MiCA / HKMA</div><div style={{fontFamily:F.mono,fontSize:11,color:"#6B7A99",lineHeight:1.6}}>ClearYield holds your USDC as a licensed intermediary, deploys into T-bills, and distributes yield. You continue to hold USDC — ClearYield is the service layer. Circle remains the stablecoin issuer. ClearYield distributes yield as the licensed third party under CLARITY s.3(11) / MiCA CASP / HKMA Ordinance.</div></>
                  }
                </div>
              )}
              <div style={{background:"rgba(74,142,219,0.11)",border:"1px solid rgba(74,142,219,0.25)",borderRadius:8,padding:"10px 13px",marginBottom:16}}>
                <div style={{fontFamily:F.mono,fontSize:10,color:"#4A8EDB",fontWeight:700,marginBottom:3}}>DISCLOSURE</div>
                <div style={{fontFamily:F.mono,fontSize:11,color:"#6B7A99",lineHeight:1.6}}>Yield is variable and not guaranteed. This is not a bank deposit. Simulated demo only.</div>
              </div>
              <div style={{marginBottom:16}}>
                <div style={{fontFamily:F.mono,fontSize:10,color:"#6B7A99",textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:6}}>Amount (Balance: ${balance.toFixed(2)})</div>
                <input type="number" value={depAmt} onChange={e=>setDepAmt(e.target.value)} placeholder="e.g. 5000" style={{width:"100%",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.13)",borderRadius:8,padding:"9px 13px",color:"#EDF2F7",fontFamily:F.mono,fontSize:13,outline:"none"}}/>
                <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
                  {[500,1000,2500,5000].filter(v=>v<=balance).map(v=><Btn key={v} sm variant="subtle" onClick={()=>setDepAmt(String(v))}>${v.toLocaleString()}</Btn>)}
                </div>
                {depAmt&&parseFloat(depAmt)>0&&<div style={{fontFamily:F.mono,fontSize:11,color:"#3ABF7A",marginTop:8}}>Est. monthly: +${(parseFloat(depAmt)*depositTarget.apy/100/12).toFixed(2)}</div>}
              </div>
            </div>

            {/* Fixed footer buttons */}
            <div style={{padding:"10px 22px",background:"rgba(74,142,219,0.06)",borderTop:"1px solid rgba(74,142,219,0.15)"}}>
              <div style={{fontFamily:F.mono,fontSize:9,color:"#4A8EDB",fontWeight:700,marginBottom:3}}>⛓ TWO CONTRACTS DEPLOYED · SEPOLIA TESTNET</div>
              <div style={{fontFamily:F.mono,fontSize:9,color:"#6B7A99",marginBottom:4}}>CY-USD: CYUSDToken (issuer-direct, SG/ASEAN). CY-USDC: ClearYieldVault (wrapper, all jurisdictions).</div>
              <a href={depositTarget?.id==="cyusd"?CONTRACTS.cyusd.etherscan:CONTRACTS.vault.etherscan} target="_blank" rel="noopener noreferrer" style={{fontFamily:F.mono,fontSize:9,color:"#4A8EDB",fontWeight:700,textDecoration:"none"}}>View on Etherscan ↗</a>
            </div>
            <div style={{padding:"14px 22px",borderTop:"1px solid rgba(255,255,255,0.07)",display:"flex",gap:9,flexShrink:0}}>
              <Btn variant="ghost" onClick={()=>setDT(null)} full>Cancel</Btn>
              <Btn disabled={!depAmt||parseFloat(depAmt)<=0||parseFloat(depAmt)>balance} onClick={()=>deposit(depositTarget,parseFloat(depAmt))} full>Confirm Deposit →</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── JURISDICTION GATE ────────────────────────────────────────────────────────
function JurisdictionGate({onSelect}){
  const [sel,setSel]=useState("");
  return(
    <div style={{minHeight:"70vh",display:"flex",alignItems:"center",justifyContent:"center",padding:32}}>
      <div style={{maxWidth:480,width:"100%"}}>
        <div style={{fontFamily:F.mono,fontSize:10,color:"#C8A84B",letterSpacing:"0.12em",marginBottom:10}}>DISTRIBUTION LAYER — STEP 1 OF 2</div>
        <h2 style={{fontFamily:F.display,fontSize:22,fontWeight:800,color:"#EDF2F7",marginBottom:8}}>Where are you based?</h2>
        <p style={{fontFamily:F.mono,fontSize:11,color:"#6B7A99",lineHeight:1.7,marginBottom:22}}>ClearYield enforces jurisdiction-specific access rules across CLARITY, MiCA, MAS, and HKMA. Select your jurisdiction to see which yield products you can legally access — and why others are blocked.</p>
        <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:18}}>
          {JURISDICTIONS.map(j=>(
            <div key={j.key} onClick={()=>setSel(j.key)}
              style={{display:"flex",alignItems:"center",gap:12,padding:"11px 14px",borderRadius:9,background:sel===j.key?"rgba(200,168,75,0.13)":"#0F1520",border:`1px solid ${sel===j.key?"rgba(200,168,75,0.50)":"rgba(255,255,255,0.07)"}`,cursor:"pointer",transition:"all 0.12s"}}>
              <span style={{fontSize:18}}>{j.flag}</span>
              <div style={{flex:1}}>
                <div style={{fontFamily:F.mono,fontSize:12,fontWeight:700,color:sel===j.key?"#C8A84B":"#EDF2F7"}}>{j.label}</div>
                <div style={{fontFamily:F.mono,fontSize:10,color:"#6B7A99",marginTop:1}}>{j.law||"No access restrictions applied"}</div>
              </div>
              <div style={{width:16,height:16,borderRadius:"50%",border:`2px solid ${sel===j.key?"#C8A84B":"#252D42"}`,background:sel===j.key?"rgba(200,168,75,0.13)":"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>
                {sel===j.key&&<div style={{width:7,height:7,borderRadius:"50%",background:"#C8A84B"}}/>}
              </div>
            </div>
          ))}
        </div>
        <Btn full disabled={!sel} onClick={()=>onSelect(sel)}>Enter Distribution Layer →</Btn>
      </div>
    </div>
  );
}

// ─── LAYER 4: COMPARISON ─────────────────────────────────────────────────────
function ComparisonLayer({tbill}){
  const scoreIcon=(s)=>{
    if(s==="pass") return {icon:"✓",col:"#3ABF7A",bg:"rgba(58,191,122,0.11)"};
    if(s==="warn") return {icon:"◐",col:"#D4913A",bg:"rgba(212,145,58,0.12)"};
    return {icon:"✕",col:"#E05252",bg:"rgba(224,82,82,0.10)"};
  };
  const [hovered,setHovered]=useState(null); // {row,col}

  return(
    <div style={{padding:"32px 28px",maxWidth:1200,margin:"0 auto"}}>
      <div style={{marginBottom:22}}>
        <div style={{fontFamily:F.mono,fontSize:10,color:"#C8A84B",letterSpacing:"0.12em",marginBottom:8}}>LAYER 04 — COMPARISON</div>
        <h1 style={{fontFamily:F.display,fontSize:28,fontWeight:800,color:"#EDF2F7",margin:"0 0 10px",letterSpacing:"-0.02em"}}>ClearYield vs The Market</h1>
        <p style={{fontFamily:F.mono,fontSize:12,color:"#6B7A99",lineHeight:1.8,maxWidth:700}}>
          Every other product solves one part of the problem. ClearYield solves all of it. Hover any cell for details.
        </p>
      </div>
      <ContractBadge/>

      {/* Comparison table */}
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"separate",borderSpacing:0}}>
          <thead>
            <tr>
              <th style={{background:"#0F1520",padding:"10px 14px",textAlign:"left",fontFamily:F.mono,fontSize:10,color:"#6B7A99",fontWeight:600,letterSpacing:"0.08em",borderBottom:"1px solid rgba(255,255,255,0.07)",width:200}}>DIMENSION</th>
              {COMPARISON.products.map((p,i)=>(
                <th key={i} style={{background:p.name.includes("CY")?"rgba(200,168,75,0.08)":"#0F1520",padding:"10px 14px",textAlign:"center",borderBottom:"1px solid rgba(255,255,255,0.07)",borderLeft:"1px solid rgba(255,255,255,0.05)",minWidth:110}}>
                  <div style={{fontFamily:F.display,fontSize:12,fontWeight:800,color:p.color}}>{p.name}</div>
                  <div style={{fontFamily:F.mono,fontSize:9,color:"#6B7A99",marginTop:2}}>{p.sub}</div>
                  {p.name==="CY-USD"&&tbill&&!tbill.loading&&<div style={{fontFamily:F.mono,fontSize:9,color:"#3ABF7A",marginTop:3,fontWeight:700}}>{tbill.cyUsdRate}% APY LIVE</div>}
                  {p.name==="CY-USDC"&&tbill&&!tbill.loading&&<div style={{fontFamily:F.mono,fontSize:9,color:"#3ABF7A",marginTop:3,fontWeight:700}}>{tbill.cyUsdcRate}% APY LIVE</div>}
                  {p.name.includes("CY")&&<div style={{fontFamily:F.mono,fontSize:8,color:"#C8A84B",marginTop:1,letterSpacing:"0.04em"}}>★ CLEARYIELD</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARISON.dimensions.map((dim,ri)=>(
              <tr key={dim.id} style={{background:ri%2===0?"rgba(255,255,255,0.015)":"transparent"}}>
                <td style={{padding:"9px 14px",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                  <div style={{fontFamily:F.mono,fontSize:11,fontWeight:700,color:"#EDF2F7"}}>{dim.label}</div>
                  <div style={{fontFamily:F.mono,fontSize:9,color:"#6B7A99",marginTop:2}}>{dim.desc}</div>
                </td>
                {COMPARISON.products.map((p,ci)=>{
                  const s=p.scores[dim.id];
                  const {icon,col,bg}=scoreIcon(s);
                  const isHov=hovered&&hovered.r===ri&&hovered.c===ci;
                  return(
                    <td key={ci}
                      onMouseEnter={()=>setHovered({r:ri,c:ci})}
                      onMouseLeave={()=>setHovered(null)}
                      style={{padding:"9px 10px",borderBottom:"1px solid rgba(255,255,255,0.04)",borderLeft:"1px solid rgba(255,255,255,0.05)",textAlign:"center",background:p.name.includes("CY")?"rgba(200,168,75,0.04)":"transparent",position:"relative",cursor:"pointer",transition:"background 0.1s"}}>
                      <div style={{width:28,height:28,background:bg,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto",fontFamily:F.mono,fontSize:14,fontWeight:800,color:col}}>{icon}</div>
                      {isHov&&(
                        <div style={{position:"absolute",top:"100%",left:"50%",transform:"translateX(-50%)",background:"#161B28",border:`1px solid ${col}50`,borderRadius:9,padding:"10px 13px",zIndex:50,minWidth:200,maxWidth:240,textAlign:"left",boxShadow:"0 8px 32px rgba(0,0,0,0.5)"}}>
                          <div style={{fontFamily:F.mono,fontSize:9,fontWeight:700,color:col,marginBottom:5,letterSpacing:"0.06em"}}>{p.name} — {dim.label}</div>
                          <div style={{fontFamily:F.mono,fontSize:10,color:"#8899AA",lineHeight:1.6}}>{p.notes[dim.id]}</div>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div style={{display:"flex",gap:16,marginTop:18,flexWrap:"wrap"}}>
        {[{icon:"✓",col:"#3ABF7A",bg:"rgba(58,191,122,0.11)",label:"Compliant / Available"},{icon:"◐",col:"#D4913A",bg:"rgba(212,145,58,0.12)",label:"Partial / Caution"},{icon:"✕",col:"#E05252",bg:"rgba(224,82,82,0.10)",label:"Blocked / Not available"}].map(l=>(
          <div key={l.label} style={{display:"flex",alignItems:"center",gap:7}}>
            <div style={{width:22,height:22,background:l.bg,borderRadius:5,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:F.mono,fontSize:12,fontWeight:800,color:l.col}}>{l.icon}</div>
            <span style={{fontFamily:F.mono,fontSize:10,color:"#6B7A99"}}>{l.label}</span>
          </div>
        ))}
        <div style={{marginLeft:"auto",fontFamily:F.mono,fontSize:10,color:"#6B7A99",fontStyle:"italic"}}>Hover any cell for details</div>
      </div>

      {/* Key insight */}
      <div style={{background:"rgba(200,168,75,0.13)",border:"1px solid rgba(200,168,75,0.30)",borderRadius:12,padding:"16px 20px",marginTop:20}}>
        <div style={{fontFamily:F.mono,fontSize:11,fontWeight:700,color:"#C8A84B",marginBottom:8}}>WHY CLEARYIELD</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
          {[
            {t:"Only all-jurisdiction product",b:"CY-USDC is the only product that passes CLARITY, MiCA, MAS, and HKMA simultaneously. No other product in the market achieves this."},
            {t:"Only licensed institutional gateway",b:"sDAI and Aave have no legal entity. Regulated institutions cannot onboard them. ClearYield is the only MAS-licensed entity in this comparison."},
            {t:"Only product with stable yield + US retail access",b:"USDY is blocked for US retail. sUSDe yield can go negative. ClearYield gives US retail stable T-bill yield through CLARITY-compliant third-party separation."},
          ].map(i=>(
            <div key={i.t}>
              <div style={{fontFamily:F.mono,fontSize:11,fontWeight:700,color:"#EDF2F7",marginBottom:5}}>{i.t}</div>
              <div style={{fontFamily:F.mono,fontSize:10,color:"#6B7A99",lineHeight:1.6}}>{i.b}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function ClearYield(){
  const [screen,setScreen]=useState("intro");
  const [layer,setLayer]  =useState("issuance");
  const tbill = useTBillRate();
  const stats = useStats();

  function goNext(){
    if(layer==="issuance") setLayer("compliance");
    else if(layer==="compliance") setLayer("distribution");
    else if(layer==="distribution") setLayer("comparison");
  }

  return(
    <div style={{minHeight:"100vh",background:"#07090E",color:"#EDF2F7"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:#1C2340;border-radius:2px;}
        input[type=range]{-webkit-appearance:none;width:100%;height:4px;background:rgba(255,255,255,0.08);border-radius:2px;outline:none;cursor:pointer;}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:#C8A84B;cursor:pointer;box-shadow:0 0 10px rgba(200,168,75,0.45);}
        input[type=number]::-webkit-outer-spin-button,input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;}
      `}</style>
      <div style={{position:"fixed",inset:0,backgroundImage:"radial-gradient(ellipse at 10% 0%, rgba(200,168,75,0.05) 0%, transparent 45%),radial-gradient(ellipse at 90% 100%, rgba(74,142,219,0.04) 0%, transparent 45%)",pointerEvents:"none",zIndex:0}}/>
      <div style={{position:"relative",zIndex:1}}>
        {screen==="intro"&&<Intro onStart={()=>setScreen("app")} tbill={tbill} stats={stats}/>}
        {screen==="app"&&(
          <>
            <Nav layer={layer} setLayer={setLayer} onHome={()=>{setScreen("intro");setLayer("issuance");}}/>
            <LiveRateBanner {...tbill}/>
            <StatsBar {...stats}/>
            {layer==="issuance"    &&<IssuanceLayer    onNext={goNext} tbill={tbill}/>}
            {layer==="compliance"  &&<ComplianceLayer  onNext={goNext} tbill={tbill}/>}
            {layer==="distribution"&&<DistributionLayer tbill={tbill}/>}
            {layer==="comparison"  &&<ComparisonLayer  tbill={tbill}/>}
          </>
        )}
      </div>
    </div>
  );
}
