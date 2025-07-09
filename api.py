from flask import Flask, request, jsonify
from flask_cors import CORS
import yfinance as yf
import pandas as pd
import joblib
import os
import sys
import types

from datetime import datetime, timedelta

# Define a dummy CyHalfSquaredError class
class CyHalfSquaredError:
    def __init__(self, *args, **kwargs):
        pass
    def __call__(self, y_true, y_pred):
        return ((y_true - y_pred) ** 2).mean()

# Fake the _loss module and register the class
_loss = types.ModuleType("_loss")
_loss.CyHalfSquaredError = CyHalfSquaredError
sys.modules["_loss"] = _loss

app = Flask(__name__)
CORS(app)

BASE_PATH = "C:/Users/dell/OneDrive/desktop/finance_web/"

# Load models and scalers
try:
    model_RF = joblib.load(os.path.join(BASE_PATH, 'model_RF.pkl'))  # High price predictor
    scaler = joblib.load(os.path.join(BASE_PATH, 'scaler.pkl'))

    rf_model = joblib.load(os.path.join(BASE_PATH, 'random_forest_model.pkl'))  # Close price models
    xgb_model = joblib.load(os.path.join(BASE_PATH, 'xgboost_model.pkl'))
    gbm_model = joblib.load(os.path.join(BASE_PATH, 'gbm_model.pkl'))
    scaler_X = joblib.load(os.path.join(BASE_PATH, 'scaler_X.pkl'))
    scaler_y = joblib.load(os.path.join(BASE_PATH, 'scaler_y.pkl'))

    print("✅ All models and scalers loaded successfully.")
except Exception as e:
    print(f"❌ Error loading model or scaler: {e}")
    model_RF = scaler = rf_model = xgb_model = gbm_model = scaler_X = scaler_y = None


@app.route('/predict', methods=['POST'])
def predict_high():
    if model_RF is None or scaler is None:
        return jsonify({'error': 'Model or scaler not loaded.'}), 500

    data = request.get_json()
    ticker = data.get('ticker')
    Open = data.get('Open')
    High = data.get('High')
    Low = data.get('Low')
    Close = data.get('Close')
    Volume = data.get('Volume')
    Dividends = data.get('Dividends', 0)
    Splits = data.get('Stock Splits', 0)

    try:
        # If not all manual values provided, fetch today's latest OHLCV
        if not all([Open, High, Low, Close, Volume]):
            if not ticker:
                return jsonify({'error': 'Either ticker or full OHLCV data must be provided.'}), 400
            stock_data = yf.download(ticker, period='2d', auto_adjust=False)
            if stock_data.empty:
                return jsonify({'error': f'No data found for ticker: {ticker}'}), 404
            latest = stock_data.iloc[-1]
            Open = float(latest['Open'])
            High = float(latest['High'])
            Low = float(latest['Low'])
            Close = float(latest['Close'])
            Volume = float(latest['Volume'])

        # Prepare input
        features = ['Open', 'High', 'Low', 'Close', 'Volume', 'Dividends', 'Stock Splits', 'target']
        input_data = pd.DataFrame([{
            'Open': Open,
            'High': High,
            'Low': Low,
            'Close': Close,
            'Volume': Volume,
            'Dividends': Dividends,
            'Stock Splits': Splits,
            'target': 0
        }])

        input_scaled = scaler.transform(input_data[features])
        model_features = ['Open', 'High', 'Low', 'Close', 'Volume', 'Dividends', 'Stock Splits']
        model_indices = [features.index(f) for f in model_features]
        prediction_scaled = model_RF.predict(input_scaled[:, model_indices])

        input_scaled_df = pd.DataFrame(input_scaled, columns=features)
        input_scaled_df['High'] = prediction_scaled
        input_inverse = scaler.inverse_transform(input_scaled_df)
        predicted_high = input_inverse[0][features.index('High')]

        return jsonify({'prediction_high': round(predicted_high, 2)})

    except Exception as e:
        print("Prediction error:", e)
        return jsonify({'error': str(e)}), 500


@app.route('/predict-close', methods=['POST'])
def predict_close():
    if None in [rf_model, xgb_model, gbm_model, scaler_X, scaler_y]:
        return jsonify({'error': 'Close price models or scalers not loaded.'}), 500

    data = request.get_json()
    ticker = data.get('ticker')
    try:
        if ticker:
            stock_data = yf.Ticker(ticker).history(period="2d")
            if len(stock_data) < 2:
                return jsonify({'error': 'Not enough data to predict'}), 400
            latest = stock_data.iloc[-1]
            prev = stock_data.iloc[-2]
            input_data = pd.DataFrame([{
                'Prev_Close': prev['Close'],
                'Prev_Open': latest['Open'],
                'Prev_High': latest['High'],
                'Prev_Low': latest['Low'],
                'Prev_Volume': latest['Volume']
            }])
        else:
            input_data = pd.DataFrame([{
                'Prev_Close': data['Prev_Close'],
                'Prev_Open': data['Prev_Open'],
                'Prev_High': data['Prev_High'],
                'Prev_Low': data['Prev_Low'],
                'Prev_Volume': data['Prev_Volume']
            }])

        input_scaled = scaler_X.transform(input_data)
        pred_rf = rf_model.predict(input_scaled)
        pred_xgb = xgb_model.predict(input_scaled)
        pred_gbm = gbm_model.predict(input_scaled)
        avg_scaled_pred = (pred_rf + pred_xgb + pred_gbm) / 3

        pred_actual = scaler_y.inverse_transform(avg_scaled_pred.reshape(-1, 1))
        predicted_close = round(pred_actual[0][0], 2)

        return jsonify({'prediction_close': predicted_close})

    except Exception as e:
        print("Close prediction error:", e)
        return jsonify({'error': str(e)}), 500


@app.route('/fetch', methods=['POST'])
def fetch_ohlcv():
    try:
        data = request.get_json()
        ticker = data.get('ticker')
        if not ticker:
            return jsonify({'error': 'Ticker is required'}), 400

        stock = yf.Ticker(ticker)
        hist = stock.history(period='2d')
        if hist.empty:
            return jsonify({'error': 'No data found for ticker'}), 404

        latest = hist.iloc[-1]

        return jsonify({
            'open': round(float(latest['Open']), 2),
            'high': round(float(latest['High']), 2),
            'low': round(float(latest['Low']), 2),
            'close': round(float(latest['Close']), 2),
            'volume': round(float(latest['Volume']), 2)
        })

    except Exception as e:
        print("OHLCV fetch error:", e)
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True)
