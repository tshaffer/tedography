const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
  mode: "development",

  entry: "./src/main.tsx",

  devtool: "inline-source-map",

  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "bundle.js",
    clean: true
  },

  resolve: {
    extensions: [".ts", ".tsx", ".js"]
  },

  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/
      }
    ]
  },

  plugins: [
    new HtmlWebpackPlugin({
      template: "./index.html"
    })
  ],

  devServer: {
    static: {
      directory: path.join(__dirname, "dist")
    },
    port: 3000,
    hot: true,
    historyApiFallback: true
  }
};