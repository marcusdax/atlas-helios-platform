"""
Nexus Mind AI Bridge Service for Atlas Helios Platform

Integrates Atlas Helios Platform with:
- G:\nexus-mind-ai (Nexus Mind AI - Cognitive Engine)
- G:\perception_models (Facebook Perception Encoder)
- G:\perception_models_shared (Shared Perception Module)

This service acts as the central bridge connecting the Node.js backend
to the Python-based AI/ML systems.
"""

import sys
import os
import json
import asyncio
import logging
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, asdict
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
import threading

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Add external module paths
sys.path.insert(0, r"G:\nexus-mind-ai")
sys.path.insert(0, r"G:\perception_models")
sys.path.insert(0, r"G:\perception_models_shared")

# Import Nexus Mind AI components
try:
    from nexus_mind.helios_integration import (
        AtlasHeliosBridge, 
        HeliosPropertyAnalyzer,
        create_helios_nexus_integration
    )
    from nexus_mind.perception_integration import (
        PerceptionEncoderWrapper,
        NexusMindPerceptionBridge,
        create_perception_enhanced_nexus
    )
    NEXUS_AVAILABLE = True
    logger.info("Nexus Mind AI integration loaded successfully")
except ImportError as e:
    NEXUS_AVAILABLE = False
    logger.warning(f"Nexus Mind AI not available: {e}")

# Import Perception Models
try:
    from perception_models_shared import PerceptionEncoder, PerceptionBridge
    PERCEPTION_AVAILABLE = True
    logger.info("Perception Encoder shared module loaded successfully")
except ImportError as e:
    PERCEPTION_AVAILABLE = False
    logger.warning(f"Perception Encoder not available: {e}")

app = Flask(__name__)
CORS(app)

# Global state
class BridgeState:
    def __init__(self):
        self.nexus_bridge = None
        self.perception_encoder = None
        self.helios_bridge = None
        self.property_analyzer = None
        self.is_initialized = False
        self.device = "cpu"
        
state = BridgeState()


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'nexus_available': NEXUS_AVAILABLE,
        'perception_available': PERCEPTION_AVAILABLE,
        'initialized': state.is_initialized,
        'components': {
            'nexus_mind': NEXUS_AVAILABLE,
            'perception_encoder': PERCEPTION_AVAILABLE,
            'helios_integration': state.helios_bridge is not None
        }
    })


@app.route('/initialize', methods=['POST'])
def initialize_bridge():
    """Initialize the bridge with all AI components"""
    try:
        data = request.get_json() or {}
        state.device = data.get('device', 'cpu')
        
        logger.info(f"Initializing Nexus Bridge on device: {state.device}")
        
        # Initialize Perception Encoder
        if PERCEPTION_AVAILABLE:
            config = data.get('perception_config', 'PE-Core-B16-224')
            state.perception_encoder = PerceptionEncoder(
                config=config,
                device=state.device,
                pretrained=True
            )
            logger.info(f"Perception Encoder initialized: {config}")
        
        # Initialize Nexus Mind AI
        if NEXUS_AVAILABLE:
            if state.perception_encoder:
                # Full integration with Perception Encoder
                bridge, pe_wrapper = create_perception_enhanced_nexus(state.device)
                state.nexus_bridge = bridge
                logger.info("Nexus Mind + Perception Encoder integration ready")
            else:
                # Nexus Mind without Perception Encoder
                integration = create_helios_nexus_integration()
                state.helios_bridge = integration['bridge']
                state.property_analyzer = integration['analyzer']
                logger.info("Nexus Mind integration ready (without Perception)")
        
        state.is_initialized = True
        
        return jsonify({
            'success': True,
            'message': 'Bridge initialized successfully',
            'components': {
                'perception_encoder': state.perception_encoder is not None,
                'nexus_bridge': state.nexus_bridge is not None,
                'helios_bridge': state.helios_bridge is not None
            }
        })
        
    except Exception as e:
        logger.error(f"Initialization failed: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/storm/analyze', methods=['POST'])
def analyze_storm_event():
    """Process storm event through Nexus Mind cognitive pipeline"""
    if not state.is_initialized:
        return jsonify({'error': 'Bridge not initialized'}), 400
    
    try:
        storm_data = request.get_json()
        logger.info(f"Processing storm event: {storm_data.get('id', 'unknown')}")
        
        if state.helios_bridge:
            # Use async wrapper for sync Flask
            import asyncio
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            result = loop.run_until_complete(
                state.helios_bridge.process_storm_event(storm_data)
            )
            loop.close()
            
            return jsonify({
                'success': True,
                'analysis': result,
                'enhanced': True,
                'timestamp': datetime.now().isoformat()
            })
        else:
            # Fallback without Nexus
            return jsonify({
                'success': True,
                'analysis': storm_data,
                'enhanced': False,
                'message': 'Nexus Mind not available - returning raw data'
            })
            
    except Exception as e:
        logger.error(f"Storm analysis failed: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/property/analyze', methods=['POST'])
def analyze_property():
    """Analyze property with CV and cognitive enhancement"""
    if not state.is_initialized:
        return jsonify({'error': 'Bridge not initialized'}), 400
    
    try:
        data = request.get_json()
        property_data = data.get('property', {})
        cv_analysis = data.get('cv_analysis', {})
        
        logger.info(f"Analyzing property: {property_data.get('id', 'unknown')}")
        
        if state.property_analyzer:
            import asyncio
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            result = loop.run_until_complete(
                state.property_analyzer.analyze_property_helios(
                    property_data, cv_analysis
                )
            )
            loop.close()
            
            return jsonify({
                'success': True,
                'analysis': result,
                'enhanced': True,
                'timestamp': datetime.now().isoformat()
            })
        else:
            # Fallback
            return jsonify({
                'success': True,
                'analysis': {
                    'property': property_data,
                    'cv_analysis': cv_analysis,
                    'cognitive_insights': None
                },
                'enhanced': False
            })
            
    except Exception as e:
        logger.error(f"Property analysis failed: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/vision/encode', methods=['POST'])
def encode_image():
    """Encode image using Perception Encoder"""
    if not state.perception_encoder:
        return jsonify({'error': 'Perception Encoder not available'}), 400
    
    try:
        data = request.get_json()
        image_path = data.get('image_path')
        
        if not image_path or not os.path.exists(image_path):
            return jsonify({'error': 'Invalid image path'}), 400
        
        logger.info(f"Encoding image: {image_path}")
        
        # Encode image
        features = state.perception_encoder.encode_image(image_path)
        
        return jsonify({
            'success': True,
            'features_shape': list(features.shape),
            'features_sample': features[:10].tolist(),  # First 10 values
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Image encoding failed: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/vision/classify', methods=['POST'])
def classify_image():
    """Zero-shot image classification using Perception Encoder"""
    if not state.perception_encoder:
        return jsonify({'error': 'Perception Encoder not available'}), 400
    
    try:
        data = request.get_json()
        image_path = data.get('image_path')
        labels = data.get('labels', [])
        
        if not image_path or not os.path.exists(image_path):
            return jsonify({'error': 'Invalid image path'}), 400
        
        if not labels:
            return jsonify({'error': 'No labels provided'}), 400
        
        logger.info(f"Classifying image: {image_path} with labels: {labels}")
        
        # Classify
        results = state.perception_encoder.classify(image_path, labels)
        predicted = state.perception_encoder.zero_shot_classify(image_path, labels)
        
        return jsonify({
            'success': True,
            'scores': results,
            'predicted': predicted,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Image classification failed: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/cognitive/process', methods=['POST'])
def cognitive_process():
    """Process data through Nexus Mind cognitive pipeline"""
    if not state.nexus_bridge and not state.helios_bridge:
        return jsonify({'error': 'Nexus Mind not available'}), 400
    
    try:
        data = request.get_json()
        sensor_data = data.get('sensor_data', [])
        context = data.get('context', {})
        
        logger.info(f"Processing cognitive request with {len(sensor_data)} sensor values")
        
        # Process through Nexus Mind
        # Note: This would use the actual nexus manager step function
        result = {
            'processed': True,
            'sensor_data': sensor_data,
            'context': context,
            'anomaly_score': 0.5,  # Placeholder
            'intent': 'monitoring',
            'timestamp': datetime.now().isoformat()
        }
        
        return jsonify({
            'success': True,
            'result': result
        })
        
    except Exception as e:
        logger.error(f"Cognitive processing failed: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/config', methods=['GET'])
def get_config():
    """Get bridge configuration"""
    return jsonify({
        'nexus_path': r'G:\nexus-mind-ai',
        'perception_path': r'G:\perception_models',
        'perception_shared_path': r'G:\perception_models_shared',
        'nexus_available': NEXUS_AVAILABLE,
        'perception_available': PERCEPTION_AVAILABLE,
        'initialized': state.is_initialized,
        'device': state.device,
        'endpoints': [
            '/health',
            '/initialize',
            '/storm/analyze',
            '/property/analyze',
            '/vision/encode',
            '/vision/classify',
            '/cognitive/process'
        ]
    })


def start_bridge_service(port=5051, host='0.0.0.0'):
    """Start the bridge service"""
    logger.info(f"Starting Nexus Bridge Service on {host}:{port}")
    logger.info(f"Nexus Mind AI: {'Available' if NEXUS_AVAILABLE else 'Not Available'}")
    logger.info(f"Perception Encoder: {'Available' if PERCEPTION_AVAILABLE else 'Not Available'}")
    
    app.run(host=host, port=port, debug=False)


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Nexus Mind Bridge Service')
    parser.add_argument('--port', type=int, default=5051, help='Port to run on')
    parser.add_argument('--host', type=str, default='0.0.0.0', help='Host to bind to')
    
    args = parser.parse_args()
    
    start_bridge_service(port=args.port, host=args.host)
