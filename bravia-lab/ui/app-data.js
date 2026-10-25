/* Offline visual catalog; app availability on Sony Linux remains unverified. */
(function(root){
  var apps=[
    {id:'kinopoisk',name:'Кинопоиск',short:'К',logo:'kinopoisk',tone:'warm',mode:'Совместимость проверяется'},
    {id:'ivi',name:'Иви',short:'иви',logo:'ivi',tone:'violet',mode:'Версия Sony под вопросом'},
    {id:'start',name:'START',short:'START',logo:'start',tone:'start',mode:'Opera TV: проверяется'},
    {id:'netflix',name:'Netflix',short:'N',logo:'netflix',tone:'netflix',mode:'Штатное приложение'},
    {id:'youtube',name:'YouTube',short:'▶',logo:'youtube',tone:'youtube',mode:'Штатное приложение'},
    {id:'rutube',name:'RUTUBE',short:'RUTUBE',logo:'rutube',tone:'blue',mode:'Linux: проверяется'},
    {id:'mediax',name:'Media Station X',short:'MSX',logo:'msx',tone:'msx',mode:'TV WebApp'},
    {id:'alpac',name:'Al(co)pac',short:'Al(co)pac',logo:'alcopa',tone:'alcopa',mode:'Клиент: проверяется'},
    {id:'browser',name:'Браузер',short:'◎',logo:'browser',tone:'browser',mode:'Штатный Vewd'},
    {id:'kion',name:'КИОН',short:'KION',logo:'kion',tone:'kion',mode:'Sony Linux: проверяется'}
  ];
  root.BRAVIA_APPS=apps;
  if(typeof module!=='undefined'&&module.exports)module.exports=apps;
}(typeof window!=='undefined'?window:global));