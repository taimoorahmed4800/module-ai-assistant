define(['jquery', 'mage/cookies'], function ($) {
    'use strict';
    return function (config, element) {
        var root = $(element), form = root.find('.ai-form'), input = root.find('#ai-message'),
            button = form.find('button'), messages = root.find('.ai-messages'), busy = false;
        function scrollToBottom() {
            var container = messages.get(0);
            container.scrollTop = container.scrollHeight;
        }
        function addMessage(text, role) {
            var item = $('<div>').addClass('ai-message').addClass('ai-message-' + role).text(text);
            messages.append(item);
            scrollToBottom();
            return item;
        }
        function safeProductUrl(value) {
            try {
                var url = new URL(value, window.location.origin);
                if (url.protocol !== 'https:' && url.protocol !== 'http:') { return null; }
                if (url.origin !== window.location.origin) { return null; }
                return url.href;
            } catch (error) { return null; }
        }
        function addProducts(products) {
            if (!Array.isArray(products) || !products.length) { return; }
            var list = $('<div>').addClass('ai-products');
            products.forEach(function (product) {
                var card = $('<article>').addClass('ai-product'), url = safeProductUrl(product.url),
                    price = Number(product.price), formatted;
                $('<h3>').text(product.name).appendTo(card);
                try {
                    formatted = new Intl.NumberFormat(undefined, {
                        style: 'currency', currency: product.currency
                    }).format(price);
                } catch (error) { formatted = String(price) + ' ' + product.currency; }
                $('<p>').text(formatted).appendTo(card);
                if (['configurable', 'bundle', 'grouped'].indexOf(product.type) !== -1) {
                    $('<small>').text('Price may vary by selection.').appendTo(card);
                }
                if (url) {
                    $('<a>').attr('href', url).addClass('action secondary').text('View product').appendTo(card);
                }
                list.append(card);
            });
            messages.append(list);
            scrollToBottom();
        }
        addMessage('Assalam-o-Alaikum! Product type aur budget batayein.', 'assistant');
        form.on('submit', function (event) {
            event.preventDefault();
            if (busy) { return; }
            var message = String(input.val() || '').trim();
            if (!message || message.length > 1000) { return; }
            var formKey = $.mage.cookies.get('form_key');
            if (!formKey) {
                addMessage('Session initialize nahi hui. Page refresh karke try karein.', 'assistant');
                return;
            }
            busy = true;
            button.prop('disabled', true);
            root.attr('aria-busy', 'true');
            addMessage(message, 'user');
            input.val('');
            var waiting = addMessage('Searching store products...', 'assistant');
            $.ajax({url: config.endpoint, type: 'POST', dataType: 'json', timeout: 65000,
                data: {form_key: formKey, message: message}
            }).done(function (response) {
                waiting.remove();
                if (!response || !response.success) {
                    addMessage(response && response.message ? response.message : 'Request failed.', 'assistant');
                    return;
                }
                addMessage(response.message, 'assistant');
                addProducts(response.products);
            }).fail(function (xhr) {
                waiting.remove();
                var response = xhr.responseJSON;
                addMessage(response && response.message ? response.message : 'Assistant unavailable. Try again.', 'assistant');
            }).always(function () {
                busy = false;
                button.prop('disabled', false);
                root.attr('aria-busy', 'false');
                input.trigger('focus');
            });
        });
    };
});
