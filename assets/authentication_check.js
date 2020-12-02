// TODO: This file needs better encapsulation and tests.
// At the moment this file does a handful of things and should really be separate files for each:
// 1) It calls GC to check a users authentication status and then records that status as cookie
// 2) It checks for that cookie and sets the shared cloudbees masthead correctly
// 3) It controls the link to CloudBees U, determining the URL based on the users authentication check

// Proposed work...
// Lets split this file into something that does the auth-check
// something that does the masthead drawing
// then if necessary, if specific sub-domains need specific JS actions based on authentication,
// lets have those subdomains add their own script controls add their own script actions

var authActions = {
    getCookie:function(id){
        var cookies = document.cookie.split(';');
        id = id + '=';
        var val = null;
        for(var i = 0; i < cookies.length; i++ ){
            if(cookies[i].indexOf(id) === 0) {
                val = cookies[i].substring(id.lenth);
            }
        }
        return val;
    },
    setCookie : function(id, val, exp, domain, path){
        if(typeof val === 'object') val = JSON.stringify(val);
        var date = new Date(exp);
        document.cookie = id + "=" + val + "; expires=" + date.toGMTString() + ";domain=" + domain + ";path=" + path;
    },
    deleteCookie : function(id){
        authActions.setCookie(id, '', -1, '', '');
    },

    drawAccount : function(data){
        function manipulateDom(data){
            var account_settings_url = this.account_settings_url;
            var $body = $('body').addClass('authentic').removeClass('unknown');
            var $box = $('#account-box');
            var $nameBox = $box.children('#account-name-box');
            var $pre = $nameBox.children('.prefix');
            var $name = $nameBox.children('#user-name');
            var $accounts =  $('#account-options');
            var userName = (data.userDetails && $.trim(data.userDetails.fullname).length > 1)?
                data.userDetails.fullname:
                data.userDetails.user;

            $('body').addClass('logged-in');
            $('.logged-in-only').show();
            $('#login-link, #top-trial').hide();
            $("#login").text("Account Settings").attr({'href': authActions.account_settings_url});
            $("#register").remove();
            $("#logout-link").click(authActions.logout).show();

            $pre.text(authActions.GREETING + ' ');
            $name.text(userName).attr({'href': authActions.account_settings_url});
            $.each(data.accounts,function(i,act){
                $accounts.append(['<option ',((act === data.currentAccount)?'selected="selected"':''),'>',act,'</option>'].join(''));
            });
        }
        authActions.userData = data;
        data.userDetails = data.userDetails || {username:data.user};
        if (!$.isEmptyObject(data.user)) {
            manipulateDom(data);
        }
        else{
            $('body').removeClass('logged-in');
            $('#login-link, #top-trial').show();
        }
        !function(){var analytics=window.analytics=window.analytics||[];if(!analytics.initialize)if(analytics.invoked)window.console&&console.error&&console.error("Segment snippet included twice.");else{analytics.invoked=!0;analytics.methods=["trackSubmit","trackClick","trackLink","trackForm","pageview","identify","reset","group","track","ready","alias","debug","page","once","off","on"];analytics.factory=function(t){return function(){var e=Array.prototype.slice.call(arguments);e.unshift(t);analytics.push(e);return analytics}};for(var t=0;t<analytics.methods.length;t++){var e=analytics.methods[t];analytics[e]=analytics.factory(e)}analytics.load=function(t,e){var n=document.createElement("script");n.type="text/javascript";n.async=!0;n.src="https://cdn.segment.com/analytics.js/v1/"+t+"/analytics.min.js";var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(n,a);analytics._loadOptions=e};analytics.SNIPPET_VERSION="4.1.0";
            analytics.load(authActions.segmentKey);
            try {
                if (data.currentAccount) {
                    analytics.identify(data["userId"], {
                        name: data["userDetails"]["fullname"],
                        firstName: data["userDetails"]["firstName"],
                        lastName: data["userDetails"]["lastName"],
                        username: data["userDetails"]["username"],
                        email: data["userDetails"]["email"],
                    });
                    analytics.group(data["currentAccountId"], {
                        name: data["currentAccount"]
                    });
                }
            } catch(err) {
                console.log("anonymous user");
            }
            analytics.page();
        }}();

        return data;
    },
    hideAccount : function(data){
        var $body = $('body').removeClass('authentic').addClass('unknown');
        $("#logout-link").hide();
        return data;
    },
    deleteCache:function(){
        this.deleteCookie(this.AUTH_STATE_COOKIE);
    },
    getMKTOObj:function(data){
        if(!data) return null;
        var pString = data.replace('"','').split('&');
        var obj = {};
        for(var i = 0; i < pString.length; i++){
            var attVal = pString[i].split(':');
            obj[attVal[0]] = attVal[1];
        }
        return obj;
    },
    setCache:function(data){
        console.log("Login status successfully checked", data);
        var wwwTracking = authActions.getCookie(authActions.WWW_TRACKING_COOKIE);
        var wwwTrackingObj = authActions.getMKTOObj(wwwTracking);
        var trackingData = $.extend({}, data);
        if (wwwTracking) {
            trackingData[authActions.WWW_TRACKING_COOKIE] = wwwTrackingObj;
            trackingData[authActions.WWW_TRACKING_COOKIE + '_string'] = wwwTracking;
        }
        if(data.user){
            authActions.setCookie(authActions.GC_TRACKING_DATA, trackingData, 2147483647, '.cloudbees.com', '/'); // never expires
            authActions.setCookie(authActions.GC_ACCOUNT_DATA, data, (20/(24*60)), '.cloudbees.com', '/'); // 20 minutes expiry
        }
        return data;
    },
    drawFromCache:function($){
        var cache = this.getCookie(this.GC_ACCOUNT_DATA);
        var tracker = this.getCookie(this.GC_TRACKING_DATA);
        if(cache){
            cache = JSON.parse(cache);
            this.drawAccount(cache);
            console.log('Data from cache:',cache);
            return cache;
        }
        else{
            if(tracker){
                tracker = JSON.parse(tracker);
                this.drawAccount(tracker);
                console.log('Data from tracker:',tracker);
            }
            return this.getAccountInfo($)
                .done(this.drawAccount)
                .then(this.setCache)
                .fail(this.hideAccount);
        }
    },
    getAccountInfo:function($){
        return this.callProxy("accounts_list",$);
    },

    callProxy: function(subUrl,$){
        $ = $ || jQuery;
        $.ajaxSetup({
            // headers : {
            //   'Authorization' : 'Basic faskd52352rwfsdfs',
            //   'X-PartnerKey' : '3252352-sdgds-sdgd-dsgs-sgs332fs3f'
            // }
            'beforeSend': function(xhr) {xhr.setRequestHeader("referer", document.location.href)}
        });
        return $.getJSON(this.gcUrl + "/proxy/"+subUrl+"?callback=?");
    },

    logout: function(e){
        e.preventDefault();
        authActions.deleteCookie(authActions.GC_ACCOUNT_DATA);
        authActions.deleteCookie(authActions.GC_TRACKING_DATA);
        document.location.href = authActions.logout_url;
    },

    setUpLinks: function($){
        $(".universityLink").click(authActions.gotoUniversity);
    },
    // TODO: This file needs better encapsulation.
    // If this is going to be the file shared by the website and other subdomains, subdomain specific checks should go elsewhere
    gotoUniversity: function(e){
        e.preventDefault();
        var failure = function(jqxhr, textStatus, error){
            console.log("Failure jqxhr ",jqxhr, "textStatus", textStatus, "error", error);
            // document.location.href = jqxhr.university_url;
        }
        var success = function(data){
            document.location.href = data.university_url;
        }
        authActions.callProxy("university",$)
            .done(success)
            .fail(failure);

        return false;
    }
};

jQuery(document).ready(function ($) {
//::TODO::FIXME::11/06/16
//
//This is a temporary conditional to allow for this file to live safely in production while
//also connection to the staging server for www.cloudbees.com running at https://cloudbeesstg.prod.acquia-sites.com/
    if(window.location.host.indexOf('acquia-sites.com') !== -1){
        console.log('auth_magic for staging...');
        var $newMasthead = $('<header class="navbar container-fluid navbar-default" id="navbar"><div class="container-fluid background-white header-container-util"><div class="container"><div class="navbar-header"><div class="row"><div class="col-xs-6 col-sm-3"><div class="logo-container"><a href="https://www.cloudbees.com" title="cloudBees.com"><img src="https://www.cloudbees.com/sites/all/themes/custom/cb_2016rev2/images/cloudbees-logo.png"></a></div></div><div class="col-xs-6 col-sm-9"><div class="utility-container"><div class="utility-links"><ul><li><a href="https://www.cloudbees.com/blog">Blog</a></li><li><a href="https://www.cloudbees.com/company">About</a></li><li id="top-login"><a class="btn btn-danger btn-lg" href="https://grandcentral.beescloud.com/login/login?login_redirect=https://go.beescloud.com">Login</a></li><li id="top-download"><div class="btn-group" id="download-menu"><button aria-expanded="false" aria-haspopup="true" class="btn btn-primary btn-lg dropdown-toggle" data-toggle="dropdown">Downloads</button><div class="dropdown-menu"><div class="view-box slide" id="download-slide"><div class="row"><div class="col-md-6 text-xs-center rolling-r" id="rolling-options"><i class="icon-service"></i><h3>Rolling Releases</h3><p class="description">Get the most from Jenkins with best and latest release. These releases contain the latest core and plugin updates with new features and fixes.</p><div class="btn-group"><a class="btn btn-primary" href="https://downloads.cloudbees.com/cje/rolling/war/2.7.20.2/jenkins.war">CloudBees Jenkins Enterprise<span class="v">2.7.20.2</span></a><button aria-expanded="false" aria-haspopup="true" class="btn btn-primary dropdown-toggle" data-container="body" data-toggle="dropdown" data-trigger="hover"></button><div class="dropdown-menu"><a class="dropdown-item" href="https://hub.docker.com/r/cloudbees/jenkins-enterprise/tags/" target="_blank"><span class="icon"></span><span class="title">Docker</span></a><a class="dropdown-item" href="https://downloads.cloudbees.com/cje/rolling/opensuse/" target="_blank"><span class="icon"></span><span class="title">OpenSUSE</span></a><a class="dropdown-item" href="https://downloads.cloudbees.com/cje/rolling/rpm/" target="_blank"><span class="icon"></span><span class="title">Red Hat/Fedora/CentOS</span></a><a class="dropdown-item" href="https://downloads.cloudbees.com/cje/rolling/debian/" target="_blank"><span class="icon"></span><span class="title">Ubuntu/Debian</span></a><a class="dropdown-item" href="https://downloads.cloudbees.com/cje/rolling/windows/jenkins-2.7.20.2.zip"><span class="icon"></span><span class="title">Windows</span></a></div></div><p class="details"><a class="item" href="https://release-notes.cloudbees.com/release/CloudBees+Jenkins+Enterprise/2.7.20.2" target="_blank">Release Notes</a>|<a class="item" href="https://downloads.cloudbees.com/cje/rolling/" target="_blank">Past Releases</a></p><div class="btn-group"><a class="btn btn-primary" href="https://downloads.cloudbees.com/cjoc/rolling/war/2.7.20.2/jenkins-oc.war">CloudBees Jenkins Operations Center<span class="v">2.7.20.2</span></a><button aria-expanded="false" aria-haspopup="true" class="btn btn-primary dropdown-toggle" data-container="body" data-toggle="dropdown" data-trigger="hover"></button><div class="dropdown-menu"><a class="dropdown-item" href="https://hub.docker.com/r/cloudbees/jenkins-operations-center/tags/" target="_blank"><span class="icon"></span><span class="title">Docker</span></a><a class="dropdown-item" href="https://downloads.cloudbees.com/cjoc/rolling/opensuse/" target="_blank"><span class="icon"></span><span class="title">OpenSUSE</span></a><a class="dropdown-item" href="https://downloads.cloudbees.com/cjoc/rolling/rpm/" target="_blank"><span class="icon"></span><span class="title">Red Hat/Fedora/CentOS</span></a><a class="dropdown-item" href="https://downloads.cloudbees.com/cjoc/rolling/debian/" target="_blank"><span class="icon"></span><span class="title">Ubuntu/Debian</span></a><a class="dropdown-item" href="https://downloads.cloudbees.com/cjoc/rolling/windows/jenkins-oc-2.7.20.2.zip"><span class="icon"></span><span class="title">Windows</span></a></div></div><p class="details"><a class="item" href="https://release-notes.cloudbees.com/release/CloudBees+Jenkins+Operations+Center/2.7.20.2" target="_blank">Release Notes</a>|<a class="item" href="https://downloads.cloudbees.com/cjoc/rolling/" target="_blank">Past Releases</a></p></div><div class="col-md-6 text-toggle fixed-r" id="get-fixed-releases"><i class="icon-lock text-xs-center"></i><div class="description"><h4>Want security updates only?</h4><p>CloudBees uses continuous delivery to create rolling releases that are the most current and highest quality version of Jenkins available.However, if you only need security updates, and no new features, we offer fixed releases.</p><a class="btn btn-secondary" onclick="$(\'#download-slide\').addClass(\'show-fixed\').removeClass(\'show-rolling\')">Get fixed releases</a></div></div><div class="col-md-6 text-xs-center fixed-r" id="fixed-options"><i class="icon-lock"></i><h3>Fixed Releases</h3><p class="description">Locked to 2.7 core with limited updates for critical fixes.</p><div class="btn-group"><a class="btn btn-primary" href="https://downloads.cloudbees.com/cje/fixed/2.7/war/2.7.20.0.2/jenkins.war">CloudBees Jenkins Enterprise<span class="v">2.7.20.0.2</span></a><button aria-expanded="false" aria-haspopup="true" class="btn btn-primary dropdown-toggle" data-container="body" data-toggle="dropdown" data-trigger="hover"></button><div class="dropdown-menu"><a class="dropdown-item" href="https://hub.docker.com/r/cloudbees/jenkins-enterprise/tags/" target="_blank"><span class="icon"></span><span class="title">Docker</span></a><a class="dropdown-item" href="https://downloads.cloudbees.com/cje/fixed/2.7/opensuse/" target="_blank"><span class="icon"></span><span class="title">OpenSUSE</span></a><a class="dropdown-item" href="https://downloads.cloudbees.com/cje/fixed/2.7/rpm/" target="_blank"><span class="icon"></span><span class="title">Red Hat/Fedora/CentOS</span></a><a class="dropdown-item" href="https://downloads.cloudbees.com/cje/fixed/2.7/debian/" target="_blank"><span class="icon"></span><span class="title">Ubuntu/Debian</span></a><a class="dropdown-item" href="https://downloads.cloudbees.com/cje/fixed/2.7/windows/jenkins-2.7.20.0.2.zip"><span class="icon"></span><span class="title">Windows</span></a></div></div><p class="details"><a class="item" href="https://release-notes.cloudbees.com/release/CloudBees+Jenkins+Enterprise/2.7.20.0.2" target="_blank">Release Notes</a>|<a class="item" href="https://downloads.cloudbees.com/cje/fixed/" target="_blank">Past Releases</a></p><div class="btn-group"><a class="btn btn-primary" href="https://downloads.cloudbees.com/cjoc/fixed/2.7/war/2.7.20.0.2/jenkins-oc.war">CloudBees Jenkins Operations Center<span class="v">2.7.20.0.2</span></a><button aria-expanded="false" aria-haspopup="true" class="btn btn-primary dropdown-toggle" data-container="body" data-toggle="dropdown" data-trigger="hover"></button><div class="dropdown-menu"><a class="dropdown-item" href="https://hub.docker.com/r/cloudbees/jenkins-operations-center/tags/" target="_blank"><span class="icon"></span><span class="title">Docker</span></a><a class="dropdown-item" href="https://downloads.cloudbees.com/cjoc/fixed/2.7/opensuse/" target="_blank"><span class="icon"></span><span class="title">OpenSUSE</span></a><a class="dropdown-item" href="https://downloads.cloudbees.com/cjoc/fixed/2.7/rpm/" target="_blank"><span class="icon"></span><span class="title">Red Hat/Fedora/CentOS</span></a><a class="dropdown-item" href="https://downloads.cloudbees.com/cjoc/fixed/2.7/debian/" target="_blank"><span class="icon"></span><span class="title">Ubuntu/Debian</span></a><a class="dropdown-item" href="https://downloads.cloudbees.com/cjoc/fixed/2.7/windows/jenkins-oc-2.7.20.0.2.zip"><span class="icon"></span><span class="title">Windows</span></a></div></div><p class="details"><a class="item" href="https://release-notes.cloudbees.com/release/CloudBees+Jenkins+Operations+Center/2.7.20.0.2" target="_blank">Release Notes</a>|<a class="item" href="https://downloads.cloudbees.com/cjoc/fixed/" target="_blank">Past Releases</a></p></div></div></div></div></div></li></ul></div></div></div></div></div></div></div></header>');
        var $masthead = $('#navbar');
        var $nav = $('#navbar > .header-container-nav');
        var $css = $('<link href="https://go.cloudbees.com/css/infinite-masthead.css" media="screen" rel="stylesheet" />').appendTo('head');
        $masthead.replaceWith($newMasthead);
        $newMasthead.append($nav);

    }
    authActions.setUpLinks($);
    userData = authActions.drawFromCache($);
});
