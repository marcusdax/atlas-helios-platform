#!/usr/bin/env python3
"""
Bridge to Perception Encoder system
"""
import sys
import json
import os

# Add paths
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'perception_models_shared'))

def main():
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No method specified'}))
        return
    
    method = sys.argv[1]
    data = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
    
    try:
        # Try to import perception encoder
        from perception_models_shared import create_perception_encoder, list_available_configs
        
        if method == 'list_configs':
            configs = list_available_configs()
            print(json.dumps({'configs': configs}))
            
        elif method == 'encode_image':
            config = data.get('config', 'PE-Core-B16-224')
            image_path = data.get('image_path')
            
            if not image_path or not os.path.exists(image_path):
                print(json.dumps({
                    'error': 'Image not found',
                    'path': image_path,
                    'mock_result': [0.1, 0.2, 0.3, 0.4, 0.5] * 128  # 640-dim mock vector
                }))
                return
                
            encoder = create_perception_encoder(config, device='cpu')
            features = encoder.encode_image(image_path)
            
            print(json.dumps({
                'features': features.tolist(),
                'dimensions': features.shape[0],
                'config': config
            }))
            
        elif method == 'classify':
            image_path = data.get('image_path')
            labels = data.get('labels', [])
            
            if not labels:
                print(json.dumps({'error': 'No labels provided'}))
                return
                
            # Mock classification result
            import random
            scores = {label: random.random() for label in labels}
            total = sum(scores.values())
            scores = {k: v/total for k, v in scores.items()}
            
            print(json.dumps({
                'classification': scores,
                'predicted': max(scores, key=scores.get),
                'image': image_path
            }))
            
        elif method == 'similarity':
            image_path = data.get('image_path')
            texts = data.get('texts', [])
            
            # Mock similarity scores
            import random
            scores = [random.random() for _ in texts]
            
            print(json.dumps({
                'similarities': scores,
                'texts': texts,
                'image': image_path
            }))
            
        else:
            print(json.dumps({'error': f'Unknown method: {method}'}))
            
    except Exception as e:
        # Return mock data if perception models aren't available
        if method == 'list_configs':
            print(json.dumps({
                'configs': {
                    'vision': ['PE-Core-G14-448', 'PE-Core-L14-336', 'PE-Core-B16-224'],
                    'spatial': ['PE-Spatial-G14-448', 'PE-Spatial-L14-448'],
                    'audio_visual': ['pe-av-small', 'pe-av-base']
                },
                'note': f'Using mock data ({str(e)})'
            }))
        elif method == 'encode_image':
            print(json.dumps({
                'features': [0.1] * 640,
                'dimensions': 640,
                'mock': True,
                'note': str(e)
            }))
        elif method == 'classify':
            labels = data.get('labels', ['unknown'])
            import random
            scores = {label: random.random() for label in labels}
            print(json.dumps({
                'classification': scores,
                'predicted': max(scores, key=scores.get),
                'mock': True
            }))
        else:
            print(json.dumps({'error': str(e), 'mock': True}))

if __name__ == '__main__':
    main()
