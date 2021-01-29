'use strict';
const ResultBuilder = require('result-builder')

class Tool {
    constructor({ page }) {
        this.page = page;
        //Build result by result-builder
        this.builder = new ResultBuilder()
    }

    async run() {
        await this._fetchMetas();
        this._validateMetas();
        this._generateTables();
        this.checkFacebook()
        this.checkTwitter()
    }

    get results() {
        return this.builder.toArray()
    }
    checkFacebook() {
        const SCORE_DEDUCTION_MAJOR = .5;
        const SCORE_DEDUCTION_MINOR = .25;
        const SCORE_DEDUCTION_CONSIDER = 0;

        this._scores = {};
        for (const domain of this._domains) {
            this._scores[domain] = 1;
        }

        const result = this.builder.newTest("facebook")
        result.setTitle("Facebook sharing optimization")
            .setDescription("Checks if your pages have all of the essential meta tags to look good when it is shared on Facebook.")
            .setWeight(.5)
            .addTableRows(this._tables.facebook)
        // Validate Facebook metas
        if (!this._meta('og:title')) {
            this._scores.facebook -= SCORE_DEDUCTION_MAJOR;
            result.addRecommendation("Add an `og:title` meta tag to your page.");
        } else if (this._meta('og:title').length > 55) {
            this._scores.facebook -= SCORE_DEDUCTION_MINOR;
            result.addRecommendation("Reduce the length of your `og:title` to 55 characters or under for better cross-platform visibility.");
        }

        if (!this._meta('og:description')) {
            this._scores.facebook -= SCORE_DEDUCTION_MAJOR;
            result.addRecommendation("Add a meta description to your page.");
        } else if (this._meta('og:description').length > 200) {
            this._scores.facebook -= SCORE_DEDUCTION_MINOR;
            result.addRecommendation("Reduce the length of your `og:description` to 200 characters or under. A length of 55 characters or under is recommended for better cross-platform visibility.");
        } else if (this._meta('og:description').length > 55) {
            this._scores.facebook -= SCORE_DEDUCTION_CONSIDER;
            result.addRecommendation("Consider reducing the length of your `og:description` to 55 characters or under for better cross-platform visibility.");
        }

        if (!this._meta('og:image')) {
            this._scores.facebook -= SCORE_DEDUCTION_MAJOR;
            result.addRecommendation("Add an `og:image` meta tag to your page. For more information, visit [Facebook's Guide to Sharing for Webmasters](https://developers.facebook.com/docs/sharing/webmasters/)");
        }
        result.setScore(this._scores.facebook)
    }
    checkTwitter() {
        const SCORE_DEDUCTION_CRUCIAL = 1;
        const SCORE_DEDUCTION_MAJOR = .5;
        const SCORE_DEDUCTION_MINOR = .25;

        this._scores = {};
        for (const domain of this._domains) {
            this._scores[domain] = 1;
        }

        const result = this.builder.newTest("twitter")
        result.setTitle("Twitter sharing optimization")
            .setDescription("Checks if your pages have all of the essential meta tags to look good when it is shared on Twitter.")
            .setWeight(.5)
            .addTableRows(this._tables.twitter)
        // Validate Twitter metas
        if (['summary', 'summary_large_image', 'app', 'player'].indexOf(this._meta('twitter:card')) == -1) {
            this._scores.twitter -= SCORE_DEDUCTION_CRUCIAL;
            result.addRecommendation("Add a valid `twitter:card` meta tag to your page. For more information, visit [Twitter's Getting Started with Cards Guide](https://developer.twitter.com/en/docs/tweets/optimize-with-cards/guides/getting-started)");
        }

        if (!this._meta('twitter:title')) {
            this._scores.twitter -= SCORE_DEDUCTION_MAJOR;
            result.addRecommendation("Add a `twitter:title` meta tag to your page.");
        } else if (this._meta('twitter:title').length > 70) {
            this._scores.twitter -= SCORE_DEDUCTION_MINOR;
            result.addRecommendation("Reduce the length of your `twitter:title` to 70 characters or under.");
        }

        if (!this._meta('twitter:description')) {
            this._scores.twitter -= SCORE_DEDUCTION_MAJOR;
            result.addRecommendation("Add a meta description to your page.");
        } else if (this._meta('twitter:description').length > 200) {
            this._scores.twitter -= SCORE_DEDUCTION_MINOR;
            result.addRecommendation("Reduce the length of your `twitter:description` to 200 characters or under.");
        }

        if (!this._meta('twitter:image')) {
            this._scores.twitter -= SCORE_DEDUCTION_MAJOR;
            result.addRecommendation("Add a `twitter:image` meta tag to your page. For more information, visit [Facebook's Guide to Sharing for Webmasters](https://developers.facebook.com/docs/sharing/webmasters/)");
        }

        if (this._meta('twitter:card') == 'player') {
            const playerUrl = this._meta('twitter:player');

            if (!playerUrl || !/^(?:https:\/\/|\/\/).*/.test(playerUrl)) {
                this._scores.twitter -= SCORE_DEDUCTION_CRUCIAL;
                result.addRecommendation("Add a valid `twitter:player` meta tag to your page. It is mandatory when using the player card. For more information, visit [Twitter's Player Card Documentation](https://developer.twitter.com/en/docs/tweets/optimize-with-cards/overview/player-card)");
            }
        }
        result.setScore(this._scores.twitter)
    }

    async cleanup() {

    }

    get _domains() {
        const domains = Object.keys(this._metas);
        domains.splice(domains.indexOf('basic'), 1);
        return domains;
    }

    _meta(key) {
        const domain = key.indexOf('og:') === 0 ? 'facebook' : 'twitter';
        try {
            return this._metas[domain][key];
        } catch (e) {
            return null;
        }
    }

    _generateTables() {
        this._tables = {};

        for (const domain of this._domains) {
            this._tables[domain] = Object.entries(this._metas[domain]);
            this._tables[domain].sort((a, b) => { return a[0].localeCompare(b[0]); });
            this._tables[domain].unshift(['Meta tag', 'Value found on your page']);
        }
    };

    _validateMetas() {

    };

    async _fetchMetas() {
        this._metas = await this.page.evaluate(() => {
            const titleNode = document.querySelector('title');
            const descriptionNode = document.querySelector('meta[name="description"]');
            const metas = {
                'basic': {
                    'title': titleNode ? titleNode.textContent.trim() : null,
                    'description': descriptionNode ? descriptionNode.getAttribute('content') : null
                },
                'facebook': {},
                'twitter': {}
            };

            // Fetch Facebook's og:* metas
            for (const node of document.querySelectorAll('meta[property^="og:"]')) {
                metas.facebook[node.getAttribute('property').toLowerCase()] = node.getAttribute('content');
            }
            // Fetch Twitter's twitter:* metas
            for (const node of document.querySelectorAll('meta[name^="twitter:"]')) {
                metas.twitter[node.getAttribute('name').toLowerCase()] = node.getAttribute('content');
            }
            // Compute fallbacks
            function computeFallback(key, fallbackValue) {
                const domain = key.indexOf('og:') === 0 ? 'facebook' : 'twitter';
                if (typeof metas[domain][key] == 'undefined' || !metas[domain][key]) {
                    metas[domain][key] = typeof fallbackValue == 'undefined' ? null : fallbackValue;
                }
            }

            computeFallback('og:title', metas.basic.title);
            computeFallback('og:description', metas.basic.description);
            computeFallback('twitter:card', null);
            computeFallback('twitter:image', metas.facebook['og:image']);
            computeFallback('twitter:title', metas.facebook['og:title']);
            computeFallback('twitter:description', metas.facebook['og:description']);

            return metas;
        });
    }
}

module.exports = Tool;