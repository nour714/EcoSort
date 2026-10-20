(function() {
    try {
        var lang = localStorage.getItem('ecosort_lang') || 'ar';
        document.documentElement.lang = lang;
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    } catch (e) {}
})();
