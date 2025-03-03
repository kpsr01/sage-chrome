const webpack = require('webpack');
const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
const Dotenv = require('dotenv-webpack');

module.exports = {
    mode: 'production',
    entry: './app.jsx',
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist'),
        clean: true
    },
    optimization: {
        minimize: true,
        minimizer: [
            new TerserPlugin({
                terserOptions: {
                    format: {
                        comments: false,
                    },
                    compress: {
                        drop_console: true,
                        drop_debugger: true,
                        pure_funcs: ['console.log']
                    }
                },
                extractComments: false
            }),
        ],
    },
    plugins: [
        new Dotenv(),
        new webpack.DefinePlugin({
            ENVIRONMENT: JSON.stringify({
                OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
                SITE_URL: process.env.SITE_URL,
                SITE_NAME: process.env.SITE_NAME
            })
        })
    ],
    module: {
        rules: [
            {
                test: /\.jsx?$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: [
                            ['@babel/preset-env', {
                                targets: {
                                    chrome: "58"
                                }
                            }]
                        ],
                        plugins: ['@babel/plugin-transform-runtime']
                    }
                }
            }
        ]
    },
    resolve: {
        extensions: ['.js', '.jsx']
    }
};
