/* 우하단 카카오톡 1:1 문의 버튼 — 모든 페이지 공통
   평소엔 원형 아이콘, 마우스를 올리면 왼쪽으로 바가 펼쳐져 "1:1 문의하기"가 보인다.
   링크를 바꾸려면 KAKAO_CHAT_URL 만 고치면 된다. */
(function () {
  var KAKAO_CHAT_URL = 'http://pf.kakao.com/_vrYrX/chat';

  var css = [
    '.kk-chat{position:fixed;right:24px;bottom:24px;z-index:1000;display:flex;align-items:center;justify-content:flex-end;',
    'height:60px;width:60px;border-radius:30px;background:#1D2087;overflow:hidden;text-decoration:none;',
    'transition:width .28s cubic-bezier(.4,0,.2,1)}',
    '.kk-chat img{position:absolute;right:0;top:0;width:60px;height:60px;display:block}',
    '.kk-chat span{padding:0 72px 0 22px;color:#FFFFFF;font-family:Pretendard,inherit;font-size:15px;font-weight:700;',
    'white-space:nowrap;opacity:0;transition:opacity .18s}',
    '@media (hover:hover){.kk-chat:hover,.kk-chat:focus-visible{width:196px}',
    '.kk-chat:hover span,.kk-chat:focus-visible span{opacity:1;transition-delay:.08s}}',
    '.kk-chat:focus-visible{outline:2px solid #FFD84D;outline-offset:3px}',
    '@media (max-width:640px){.kk-chat{right:16px;bottom:16px;width:56px;height:56px}.kk-chat img{width:56px;height:56px}}',
    '@media (prefers-reduced-motion:reduce){.kk-chat,.kk-chat span{transition:none}}',
    /* 기존 "프로그램 소개서 받기" 말풍선은 카톡 버튼 위로 올린다 */
    '.bubble-cta,div[style*="position:fixed;bottom:24px;right:24px"]{bottom:100px!important}',
    '@media (max-width:640px){.bubble-cta,div[style*="position:fixed;bottom:24px;right:24px"]{bottom:84px!important}}'
  ].join('');

  function mount() {
    if (document.querySelector('.kk-chat')) return;
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    var a = document.createElement('a');
    a.className = 'kk-chat';
    a.href = KAKAO_CHAT_URL;
    a.target = '_blank';
    a.rel = 'noopener';
    a.setAttribute('aria-label', '카카오톡 1:1 문의하기');
    a.innerHTML = '<span>1:1 문의하기</span><img src="/assets/images/kakao-talk.webp" alt="" width="60" height="60">';
    a.addEventListener('click', function () {
      if (window.gtag) gtag('event', 'kakao_click', { page_path: location.pathname });
    });
    document.body.appendChild(a);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
