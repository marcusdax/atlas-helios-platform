#!/usr/bin/env python3
"""
Bridge to Nexus Mind AI system
"""
import sys
import json
import os

# Add paths
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'nexus_mind'))

# Mock the neural components for demo (since we don't have actual model weights)
class MockNexusManager:
    """Mock manager for demo purposes"""
    def __init__(self, device='cpu'):
        self.device = device
        self.alert_level = 0.0
        self.history = []
        
    def step(self, sensor_data=None, geo_data=None, behavior_data=None):
        import random
        self.alert_level = random.random()
        result = {
            'alert_level': self.alert_level,
            'fusion_score': random.random(),
            'predictions': [random.random() for _ in range(5)],
            'timestamp': str(datetime.now()) if 'datetime' in globals() else 'now'
        }
        self.history.append(result)
        return result
    
    def get_state(self):
        return {
            'alert_level': self.alert_level,
            'history_length': len(self.history),
            'device': self.device
        }

# Global manager instance
_manager = None

def get_manager():
    global _manager
    if _manager is None:
        try:
            # Try to import real nexus_mind
            from nexus_mind.main import build_full_nexus
            _manager = build_full_nexus('cpu')
        except Exception as e:
            # Fall back to mock
            print(f"Warning: Using mock Nexus Mind ({e})", file=sys.stderr)
            _manager = MockNexusManager('cpu')
    return _manager

def main():
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No method specified'}))
        return
    
    method = sys.argv[1]
    data = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
    
    manager = get_manager()
    
    if method == 'inference':
        import torch
        sensor = data.get('sensor_data')
        geo = data.get('geo_data')
        behavior = data.get('behavior_data')
        
        if sensor is None:
            sensor = torch.randn(4, 10, 64)
        else:
            sensor = torch.tensor(sensor)
            
        result = manager.step(sensor, geo, behavior)
        
        # Convert tensors to serializable format
        serializable_result = {}
        for key, value in result.items() if isinstance(result, dict) else []:
            if hasattr(value, 'tolist'):
                serializable_result[key] = value.tolist()
            else:
                serializable_result[key] = value
        
        print(json.dumps(serializable_result))
        
    elif method == 'status':
        try:
            state = manager.get_state()
            print(json.dumps(state))
        except:
            print(json.dumps({'status': 'running', 'mock': True}))
            
    elif method == 'cognitive_step':
        result = manager.step(
            data.get('sensor'),
            data.get('geo'),
            data.get('behavior')
        )
        print(json.dumps({'status': 'success', 'result': str(result)}))
        
    else:
        print(json.dumps({'error': f'Unknown method: {method}'}))

if __name__ == '__main__':
    from datetime import datetime
    main()
