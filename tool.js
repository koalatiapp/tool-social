'use strict';

class Tool {
    /**
     * Creates and initializes an instance of your tool
     * Puppeteer's Page class documentation: https://pptr.dev/#?product=Puppeteer&version=main&show=api-class-page
     *
     * @param {Object} page The current Puppeteer page's instance
     * @param {Object} devices A list of devices to be used with page.emulate(). This is a reference to puppeteer.devices.
     */
    constructor(page, devices) {
        this.page = page;
        this.devices = devices;
    }

    async run() {
        await this._fetchMetas();
        this._validateMetas();
        this._generateTables();
    }

    get results() {
        return [
            {
                'uniqueName': 'facebook',
                'title': 'Facebook sharing optimization',
                'description': 'Checks if your pages have all of the essential meta tags to look good when it is shared on Facebook.',
                'weight': .5,
                'score': this._scores.facebook,
                'table': this._tables.facebook,
                'recommendations': this._recommendations.facebook
            },
            {
                'uniqueName': 'twitter',
                'title': 'Twitter sharing optimization',
                'description': 'Checks if your pages have all of the essential meta tags to look good when it is shared on Twitter.',
                'weight': .5,
                'score': this._scores.twitter,
                'table': this._tables.twitter,
                'recommendations': this._recommendations.twitter
            },
        ];
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
        const SCORE_DEDUCTION_CRUCIAL = 1;
        const SCORE_DEDUCTION_MAJOR = .5;
        const SCORE_DEDUCTION_MINOR = .25;
        const SCORE_DEDUCTION_CONSIDER = 0;

        this._recommendations = {};
        this._scores = {};

        for (const domain of this._domains) {
            this._scores[domain] = 1;
            this._recommendations[domain] = [];
        }

        // Validate Facebook metas
        if (!this._meta('og:title')) {
            this._scores.facebook -= SCORE_DEDUCTION_MAJOR;
            this._recommendations.facebook.push("Add an `og:title` meta tag to your page.");
        } else if (this._meta('og:title').length > 55) {
            this._scores.facebook -= SCORE_DEDUCTION_MINOR;
            this._recommendations.facebook.push("Reduce the length of your `og:title` to 55 characters or under for better cross-platform visibility.");
        }

        if (!this._meta('og:description')) {
            this._scores.facebook -= SCORE_DEDUCTION_MAJOR;
            this._recommendations.facebook.push("Add a meta description to your page.");
        } else if (this._meta('og:description').length > 200) {
            this._scores.facebook -= SCORE_DEDUCTION_MINOR;
            this._recommendations.facebook.push("Reduce the length of your `og:description` to 200 characters or under. A length of 55 characters or under is recommended for better cross-platform visibility.");
        } else if (this._meta('og:description').length > 55) {
            this._scores.facebook -= SCORE_DEDUCTION_CONSIDER;
            this._recommendations.facebook.push("Consider reducing the length of your `og:description` to 55 characters or under for better cross-platform visibility.");
        }

        if (!this._meta('og:image')) {
            this._scores.facebook -= SCORE_DEDUCTION_MAJOR;
            this._recommendations.facebook.push("Add an `og:image` meta tag to your page. For more information, visit [Facebook's Guide to Sharing for Webmasters](https://developers.facebook.com/docs/sharing/webmasters/)");
        }


        // Validate Twitter metas
        if (['summary', 'summary_large_image', 'app', 'player'].indexOf(this._meta('twitter:card')) == -1) {
            this._scores.twitter -= SCORE_DEDUCTION_CRUCIAL;
            this._recommendations.twitter.push("Add a valid `twitter:card` meta tag to your page. For more information, visit [Twitter's Getting Started with Cards Guide](https://developer.twitter.com/en/docs/tweets/optimize-with-cards/guides/getting-started)");
        }

        if (!this._meta('twitter:title')) {
            this._scores.twitter -= SCORE_DEDUCTION_MAJOR;
            this._recommendations.twitter.push("Add a `twitter:title` meta tag to your page.");
        } else if (this._meta('twitter:title').length > 70) {
            this._scores.twitter -= SCORE_DEDUCTION_MINOR;
            this._recommendations.twitter.push("Reduce the length of your `twitter:title` to 70 characters or under.");
        }

        if (!this._meta('twitter:description')) {
            this._scores.twitter -= SCORE_DEDUCTION_MAJOR;
            this._recommendations.twitter.push("Add a meta description to your page.");
        } else if (this._meta('twitter:description').length > 200) {
            this._scores.twitter -= SCORE_DEDUCTION_MINOR;
            this._recommendations.twitter.push("Reduce the length of your `twitter:description` to 200 characters or under.");
        }

        if (!this._meta('twitter:image')) {
            this._scores.twitter -= SCORE_DEDUCTION_MAJOR;
            this._recommendations.twitter.push("Add a `twitter:image` meta tag to your page. For more information, visit [Facebook's Guide to Sharing for Webmasters](https://developers.facebook.com/docs/sharing/webmasters/)");
        }

        if (this._meta('twitter:card') == 'player') {
            const playerUrl = this._meta('twitter:player');

            if (!playerUrl || !/^(?:https:\/\/|\/\/).*/.test(playerUrl)) {
                this._scores.twitter -= SCORE_DEDUCTION_CRUCIAL;
                this._recommendations.twitter.push("Add a valid `twitter:player` meta tag to your page. It is mandatory when using the player card. For more information, visit [Twitter's Player Card Documentation](https://developer.twitter.com/en/docs/tweets/optimize-with-cards/overview/player-card)");
            }
        }
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
                    metas[domain][key] = typeof fallbackValue == 'undefined' ?  null : fallbackValue;
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
