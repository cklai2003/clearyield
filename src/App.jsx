import { useState, useEffect, useRef } from "react";

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
const F = { display:"'Syne',sans-serif", mono:"'JetBrains Mono',monospace" };

const YIELD_SOURCES = [
  { id:"tbill", name:"US Treasury Bills", issuer:"US Gov / Custodian Banks", mechanism:"Short-term government debt", apy:"4.3–4.8%", risk:"Low", color:"#4A8EDB", logo:"TB",
    whyNot:"Under CLARITY Act s.3(11), an issuer holding T-bills in reserve cannot pass that yield to stablecoin holders. Doing so constitutes paying interest 'merely for holding' — precisely what the Act prohibits. MiCA Article 40 and HKMA Ordinance impose the same restriction.",
    howCY:"Two models depending on your jurisdiction. Singapore users: ClearYield is its own MPI-licensed issuer — it holds T-bills 1:1 and pays yield directly to CY-USD holders under MAS SCS. No wrapper needed. US/EU/HK users: ClearYield holds USDC as a licensed third-party intermediary, deploys into T-bills, and distributes yield. Circle never touches the yield. ClearYield does.",
    precedent:"USDY (Ondo Finance) uses a Cayman SPV and Reg S exemption — restricted from US retail. CY-USD improves on this: Singapore users get the issuer-direct model (no SPV, no Reg S restriction). US users get the third-party wrapper model (CLARITY-compliant, accessible to US retail). One product covering both architectures." },
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
  { id:"cyusd", name:"ClearYield USD (CY-USD)", type:"Dual-Structure — Jurisdiction-Aware Yield", color:"#C8A84B", logo:"CY", isNative:true, apy:4.6, risk:"Low",
    desc:"One product, two legal structures. For Singapore users: CY-USD is ClearYield's own MPI-licensed stablecoin — ClearYield is the issuer paying T-bill reserve yield directly under MAS SCS. No wrapper required. For US, EU, and HK users: ClearYield wraps USDC as a licensed third-party intermediary under the respective framework (CLARITY third-party separation / MiCA CASP / HKMA licensed intermediary). Same yield, different legal architecture. Jurisdiction-determined at onboarding.",
    howey:{ p1:{r:"pass",note:"User exchanges USDC for CY-USD — investment of money satisfied."}, p2:{r:"warn",note:"Funds pooled in ClearYield's MPI-licensed reserve. ClearYield is the issuer AND the yield distributor — permitted under Singapore SCS. The common enterprise is with ClearYield as a regulated MAS entity."}, p3:{r:"warn",note:"Variable yield reflecting T-bill market rates. Not a fixed guaranteed return. Analogous to a money market fund distributing reserve income — strong argument against securities classification."}, p4:{r:"warn",note:"Yield from ClearYield's T-bill reserve management — pass-through income, not speculative management. MAS SCS framework explicitly permits this. Stronger legal footing than sDAI grey zone."} },
    jScores:{clarity:"pass",mica:"pass",mas:"pass",hkma:"pass"},
    jNotes:{ clarity:"US/EU users receive yield via the CLARITY-compliant third-party wrapper structure — ClearYield holds USDC on behalf of users and distributes T-bill yield as a licensed intermediary. Circle never touches the yield distribution. This is the GENIUS Act / CLARITY Act explicitly permitted architecture.", mica:"EU users access via the MiCA CASP route — ClearYield as a licensed intermediary offers yield as a separate service agreement on top of the underlying stablecoin. MiCA Art. 40 prohibits the issuer, not ClearYield.", mas:"Singapore/ASEAN users access CY-USD as ClearYield's own MPI-licensed stablecoin. ClearYield is the issuer distributing reserve yield DIRECTLY — no third-party wrapper required. This is the Singapore SCS window: the product Circle legally cannot offer from its US domicile.", hkma:"HK users access via licensed third-party distribution. HKMA Stablecoins Ordinance (May 2025) explicitly permits this structure." },
    verdict:"COMPLIANT", verdictColor:"#3ABF7A",
    insight:"CY-USD demonstrates the regulatory divergence in a single product. Singapore users: ClearYield is the MPI-licensed issuer paying yield directly under MAS SCS — no wrapper needed. US, EU, and HK users: ClearYield operates as the licensed third-party wrapper. The distinction matters: only Singapore explicitly permits issuer-direct yield. HKMA and MiCA require the third-party separation that CLARITY also mandates." },
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

function getAccess(vault,jKey){
  if(!jKey||jKey==="OTHER") return {blocked:false,warned:false};
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

// ─── INTRO ────────────────────────────────────────────────────────────────────
function Intro({onStart}){
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
        <div style={{fontFamily:F.mono,fontSize:10,color:"#252D4299",marginTop:14}}>Singapore · MAS Payment Services Act · Capital protected by T-bill reserves</div>
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
          {[{k:"issuance",n:"01",l:"Issuance"},{k:"compliance",n:"02",l:"Compliance"},{k:"distribution",n:"03",l:"Distribution"}].map(s=>(
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
function ComplianceLayer({onNext}){
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
function DistributionLayer(){
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

  function fire(msg){setToast(msg);setTimeout(()=>setToast(null),3000);}
  if(!jKey) return <JurisdictionGate onSelect={setJKey}/>;

  const jConfig=JURISDICTIONS.find(j=>j.key===jKey);
  const active=positions.filter(p=>!p.redeemed);
  const totalDep=active.reduce((s,p)=>s+p.amt,0);
  const simEarn=active.reduce((s,p)=>s+(p.amt*(p.apy/100)*(simDays/365)),0);

  function deposit(vault,amt){
    setBalance(b=>b-amt);
    setPos(p=>[...p,{id:`${vault.id}-${Date.now()}`,vaultId:vault.id,name:vault.name,color:vault.color,logo:vault.logo,apy:vault.apy,amt,depositedOn:new Date().toLocaleDateString("en-SG"),isNative:vault.isNative}]);
    setDT(null);setDepAmt("");setView("portfolio");
    fire(`Deposited $${amt.toLocaleString()} into ${vault.name}`);
  }

  return(
    <div>
      {toast&&<div style={{position:"fixed",bottom:24,right:24,zIndex:999,background:"#0F1520",border:"1px solid rgba(58,191,122,0.40)",borderRadius:12,padding:"12px 18px",fontFamily:F.mono,fontSize:13,fontWeight:700,color:"#3ABF7A",boxShadow:"0 16px 48px rgba(0,0,0,0.5)"}}>{toast}</div>}

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
                  {vault.isNative&&<div style={{background:"rgba(200,168,75,0.13)",borderBottom:"1px solid rgba(200,168,75,0.25)",padding:"5px 14px",display:"flex",alignItems:"center",gap:6}}><span style={{fontFamily:F.mono,fontSize:10,fontWeight:700,color:"#C8A84B",letterSpacing:"0.05em"}}>★ CLEARYIELD NATIVE</span><span style={{fontFamily:F.mono,fontSize:9,color:"#6B7A99"}}>· Dual-structure · Jurisdiction-aware · SG issuer-direct · US/EU wrapper</span></div>}
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
                        <div style={{fontFamily:F.display,fontWeight:800,color:vault.color,fontSize:18,lineHeight:1}}>{vault.apy}%</div>
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
                    {vault.isNative&&!access.blocked&&<div style={{background:"rgba(58,191,122,0.11)",border:"1px solid rgba(58,191,122,0.25)",borderRadius:7,padding:"6px 10px",marginBottom:9,fontFamily:F.mono,fontSize:10,color:"#3ABF7A"}}>{jKey==="SG"?"🇸🇬 Issuer-direct: ClearYield is the MPI-licensed issuer paying T-bill yield directly under MAS SCS — no wrapper required.":jKey==="OTHER"?"Direct reserve yield — ClearYield as Singapore MPI-licensed issuer.":"🌐 Wrapper model: ClearYield holds your USDC as a licensed third-party intermediary and distributes T-bill yield under your jurisdiction's framework (CLARITY / MiCA CASP / HKMA licensed intermediary)."}</div>}
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
                  <Btn sm variant="success" onClick={()=>{setBalance(b=>b+p.amt);setPos(ps=>ps.map(x=>x.id===p.id?{...x,redeemed:true}:x));fire(`Redeemed $${p.amt.toLocaleString()} from ${p.name}`);}}>Redeem</Btn>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Deposit modal */}
      {depositTarget&&(
        <div style={{position:"fixed",inset:0,background:"rgba(7,9,14,0.88)",backdropFilter:"blur(14px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:20}}>
          <div style={{background:"#0F1520",border:`1px solid ${depositTarget.color}30`,borderRadius:16,padding:26,width:"100%",maxWidth:460,boxShadow:`0 0 60px ${depositTarget.color}18`}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}>
              <div style={{width:36,height:36,background:`${depositTarget.color}20`,border:`1px solid ${depositTarget.color}35`,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:F.display,fontWeight:800,fontSize:12,color:depositTarget.color}}>{depositTarget.logo}</div>
              <div>
                <div style={{fontFamily:F.display,fontWeight:800,fontSize:15,color:"#EDF2F7"}}>{depositTarget.name}</div>
                <div style={{fontFamily:F.mono,fontSize:11,color:"#6B7A99"}}>{depositTarget.apy}% APY · {depositTarget.risk} risk</div>
              </div>
              <button onClick={()=>setDT(null)} style={{marginLeft:"auto",background:"none",border:"none",color:"#6B7A99",fontSize:18,cursor:"pointer"}}>×</button>
            </div>
            {depositTarget.isNative&&(
              <div style={{background:"rgba(58,191,122,0.11)",border:"1px solid rgba(58,191,122,0.25)",borderRadius:8,padding:"10px 13px",marginBottom:12}}>
                {jKey==="SG"
                  ?<><div style={{fontFamily:F.mono,fontSize:10,fontWeight:700,color:"#3ABF7A",marginBottom:3}}>🇸🇬 SINGAPORE SCS — ISSUER-DIRECT MODEL</div><div style={{fontFamily:F.mono,fontSize:11,color:"#6B7A99",lineHeight:1.6}}>ClearYield is the MPI-licensed issuer of CY-USD. Under MAS SCS, ClearYield as issuer distributes T-bill reserve yield directly to holders — no third-party wrapper required. This is the product Circle and Tether legally cannot offer from their US or EU domiciles. You are buying ClearYield's own stablecoin, backed 1:1 by T-bills.</div></>
                  :<><div style={{fontFamily:F.mono,fontSize:10,fontWeight:700,color:"#3ABF7A",marginBottom:3}}>🌐 THIRD-PARTY WRAPPER MODEL</div><div style={{fontFamily:F.mono,fontSize:11,color:"#6B7A99",lineHeight:1.6}}>For US, EU, and HK users, CY-USD operates as a wrapper. You hold USDC — ClearYield holds it as a licensed third-party intermediary, deploys into T-bills, and distributes yield to you. The stablecoin issuer (Circle) never pays yield. ClearYield does — as the licensed intermediary permitted under CLARITY s.3(11) / MiCA CASP / HKMA Stablecoins Ordinance. Note: HKMA does not contain an explicit issuer-direct provision equivalent to MAS PSN08.</div></>
                }
              </div>
            )}
            <div style={{background:"rgba(74,142,219,0.11)",border:"1px solid rgba(74,142,219,0.25)",borderRadius:8,padding:"10px 13px",marginBottom:18}}>
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
            <div style={{display:"flex",gap:9}}>
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

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function ClearYield(){
  const [screen,setScreen]=useState("intro");
  const [layer,setLayer]  =useState("issuance");

  function goNext(){
    if(layer==="issuance") setLayer("compliance");
    else if(layer==="compliance") setLayer("distribution");
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
        {screen==="intro"&&<Intro onStart={()=>setScreen("app")}/>}
        {screen==="app"&&(
          <>
            <Nav layer={layer} setLayer={setLayer} onHome={()=>{setScreen("intro");setLayer("issuance");}}/>
            {layer==="issuance"    &&<IssuanceLayer    onNext={goNext}/>}
            {layer==="compliance"  &&<ComplianceLayer  onNext={goNext}/>}
            {layer==="distribution"&&<DistributionLayer/>}
          </>
        )}
      </div>
    </div>
  );
}
