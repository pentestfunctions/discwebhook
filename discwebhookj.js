// ==UserScript==
// @name        Discord Webhook
// @namespace   http://tampermonkey.net/
// @version     2.1
// @description Get chat messages and send to a discord webhook
// @author      You
// @match       *://discord.com/*
// @grant       GM_xmlhttpRequest
// @require     https://ajax.googleapis.com/ajax/libs/jquery/3.5.1/jquery.min.js
// ==/UserScript==

(function() {
    'use strict';

    const webhookUrl = "WEBHOOKHERE";
    let lastUsername = '';
    let lastAvatar = '';
    let messageCache = [];

    const handleEmbeds = (node) => {
        const embeds = $(node).find('div[id^="embedWrapper"]');
        let embedList = [];
        if (embeds.length > 0) {
            embeds.each((index, embedNode) => {
                const imageUrl = $(embedNode).find('div[id^="imageWrapper"] .lazyImg-ewiNCh').attr('src');
                const videoUrl = $(embedNode).find('.video-2HW4jD').attr('src');
                if (imageUrl) {
                    embedList.push({
                        type: 'image',
                        url: imageUrl
                    });
                } else if (videoUrl) {
                    embedList.push({
                        type: 'video',
                        url: videoUrl
                    });
                } else {
                    const linkUrl = $(embedNode).find('.anchor-3Z-8Bb').attr('href');
                    if (linkUrl) {
                        embedList.push({
                            type: 'link',
                            url: linkUrl
                        });
                    }
                }
            });
        }

    return embedList;
};

    const handleReactions = (node) => {
        const reactions = $(node).find('.reaction-3vwAF2');
        let reactionList = [];
        if (reactions.length > 0) {
            reactions.each((index, reactionNode) => {
                const emojiImg = $(reactionNode).find('.emoji').attr('src');
                const emojiAlt = $(reactionNode).find('.emoji').attr('alt');
                const count = $(reactionNode).find('.reactionCount-26U4As').text();
                reactionList.push({
                    type: 'reaction',
                    emojiImg: emojiImg,
                    emojiAlt: emojiAlt,
                    count: count
                });
            });
        }
        return reactionList;
    };

    const sendMessageToWebhook = (username, message, avatar) => {
        if (messageCache.includes(message)) return;

        // adjust the avatar URL if it's a Discord default avatar
        if (avatar && avatar.startsWith('/assets/')) {
            avatar = 'https://discord.com' + avatar;
        }

        GM_xmlhttpRequest({
            method: "POST",
            url: webhookUrl,
            data: JSON.stringify({
                username: username,
                content: message,
                avatar_url: avatar
            }),
            headers: {
                "Content-Type": "application/json"
            }
        });

        messageCache.push(message);

        if (messageCache.length > 100) {
            messageCache.shift();
        }
    };

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1 && node.id && node.id.startsWith('chat-messages-')) {
                    let username = $(node).find(".headerText-2z4IhQ span.username-h_Y3Us").text();
                    let avatar = $(node).find('.avatar-2e8lTP, .replyAvatar-sHd2sU').attr('src');

                    if (!username && !avatar) {
                        username = lastUsername;
                        avatar = lastAvatar;
                    } else {
                        lastUsername = username;
                        lastAvatar = avatar;
                    }

                    let message;
                    let embeds = handleEmbeds(node);
                    let reactions = handleReactions(node);

                    if (reactions.length > 0) {
                        reactions.forEach(reaction => {
                            message = `${username} reacted with ${reaction.emojiAlt} (${reaction.count}) [Emoji Image](${reaction.emojiImg})`;
                            sendMessageToWebhook(username, message, avatar);
                        });
                    } else {
                        const isReply = $(node).find(".repliedMessage-3Z6XBG").length > 0;

                        if(isReply) {
                            const originalAuthor = $(node).find(".repliedMessage-3Z6XBG .username-h_Y3Us").text();
                            const originalMessage = $(node).find(".repliedMessage-3Z6XBG .repliedTextContent-2hOYMB span").first().text();
                            const replyNode = $(node).clone();
                            replyNode.find(".repliedMessage-3Z6XBG").remove();
                            const newMessage = replyNode.find(".markup-eYLPri.messageContent-2t3eCI").text().trim();
                            message = `${username} replied to ${originalAuthor}:\n> ${originalMessage}\n${newMessage}`;
                        } else {
                            message = $(node).find(".markup-eYLPri.messageContent-2t3eCI").text().trim();
                        }

                        if (embeds.length > 0) {
                            embeds.forEach(embed => {
                                message += `\n[Image](${embed.url})`;
                            });
                        }

                        sendMessageToWebhook(username, message, avatar);
                    }
                }
            });
        });
    });

    const chatContainer = document.querySelector('body');
    observer.observe(chatContainer, { childList: true, subtree: true });
})();
