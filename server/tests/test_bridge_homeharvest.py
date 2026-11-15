"""
Test suite for HomeHarvest Bridge (bridge_homeharvest.py).
Tests the bridge functionality with HomeHarvest v0.8.18 API.
"""

import sys
import os
import json

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest


class TestBridgeHomeHarvest:
    """Tests for HomeHarvest Bridge functions."""
    
    @pytest.fixture
    def bridge(self):
        """Import the bridge module."""
        import bridge_homeharvest
        return bridge_homeharvest
    
    def test_list_methods(self, bridge):
        """Test that list_methods returns expected structure."""
        result = bridge.list_methods()
        
        assert "methods" in result
        assert isinstance(result["methods"], list)
        assert len(result["methods"]) == 3
        
        method_names = [m["name"] for m in result["methods"]]
        assert "search_properties" in method_names
        assert "get_property_details" in method_names
        assert "search_by_coords" in method_names
    
    def test_search_properties_basic(self, bridge):
        """Test search_properties returns valid structure."""
        # This tests the bridge interface, not actual network calls
        # Use a known location that should work
        result = bridge.search_properties("Dallas, TX", radius=5, limit=3, listing_type="for_sale")
        
        # Should return a dict with properties and count
        assert "properties" in result
        assert "count" in result
        assert isinstance(result["properties"], list)
        assert isinstance(result["count"], int)
        assert result["count"] == len(result["properties"])
    
    def test_search_properties_structure(self, bridge):
        """Test that returned properties have expected fields."""
        result = bridge.search_properties("Dallas, TX", radius=5, limit=1, listing_type="for_sale")
        
        if result["count"] > 0:
            prop = result["properties"][0]
            
            # Check required fields exist
            expected_fields = [
                "mls_id", "address", "city", "state", "zip_code",
                "latitude", "longitude", "list_price", "status", "source"
            ]
            for field in expected_fields:
                assert field in prop, f"Missing field: {field}"
            
            # Check field types
            assert isinstance(prop["mls_id"], (str, type(None)))
            assert isinstance(prop["city"], (str, type(None)))
            assert isinstance(prop["state"], (str, type(None)))
            assert isinstance(prop["latitude"], (float, int, type(None)))
            assert isinstance(prop["longitude"], (float, int, type(None)))
            assert prop["source"] == "Realtor.com via HomeHarvest v0.8.18"
    
    def test_get_property_details(self, bridge):
        """Test get_property_details with known MLS ID."""
        # First search to get a valid MLS ID
        search_result = bridge.search_properties("Dallas, TX", radius=5, limit=1, listing_type="for_sale")
        
        if search_result["count"] > 0:
            mls_id = search_result["properties"][0]["mls_id"]
            
            # Now get details
            detail_result = bridge.get_property_details(mls_id)
            
            # Should find the property
            assert "property" in detail_result or "error" in detail_result
            
            if "property" in detail_result:
                prop = detail_result["property"]
                assert prop["mls_id"] == mls_id
                
                # Check for extra detail fields
                detail_fields = [
                    "description", "details", "photos", "tags",
                    "neighborhoods", "county", "tax_history"
                ]
                for field in detail_fields:
                    assert field in prop, f"Missing detail field: {field}"
    
    def test_search_by_coords(self, bridge):
        """Test search_by_coords returns valid structure."""
        # Dallas coordinates
        result = bridge.search_by_coords(32.7767, -96.7970, radius=2, limit=3, listing_type="for_sale")
        
        assert "properties" in result
        assert "count" in result
        assert isinstance(result["properties"], list)
        assert isinstance(result["count"], int)
        assert result["count"] == len(result["properties"])
    
    def test_search_by_coords_structure(self, bridge):
        """Test that search_by_coords returns properties with expected fields."""
        result = bridge.search_by_coords(32.7767, -96.7970, radius=2, limit=1, listing_type="for_sale")
        
        if result["count"] > 0:
            prop = result["properties"][0]
            
            expected_fields = [
                "mls_id", "address", "city", "state", "zip_code",
                "latitude", "longitude", "list_price", "status", "source"
            ]
            for field in expected_fields:
                assert field in prop, f"Missing field: {field}"
    
    def test_error_handling_missing_homeharvest(self, bridge, monkeypatch):
        """Test error handling when homeharvest is not installed."""
        # Mock the import to fail
        import builtins
        original_import = builtins.__import__
        
        def mock_import(name, *args, **kwargs):
            if name == "homeharvest":
                raise ImportError("No module named 'homeharvest'")
            return original_import(name, *args, **kwargs)
        
        monkeypatch.setattr(builtins, "__import__", mock_import)
        
        # Reload module to trigger import error
        import importlib
        importlib.reload(bridge)
        
        result = bridge.search_properties("Dallas, TX")
        assert "error" in result
        assert "not installed" in result["error"]
        
        # Restore
        monkeypatch.setattr(builtins, "__import__", original_import)
        importlib.reload(bridge)


class TestNormalizeProperty:
    """Tests for the _normalize_property internal function."""
    
    def test_normalize_property_structure(self):
        """Test that _normalize_property produces expected output structure."""
        from bridge_homeharvest import _normalize_property
        
        # Create a mock property object similar to HomeHarvest's Property model
        class MockAddress:
            full_line = "123 Test St"
            city = "Dallas"
            state = "TX"
            zip = "75201"
        
        class MockDescription:
            sqft = 2000
            beds = 3
            baths_full = 2
            baths_half = 1
            lot_sqft = 5000
            year_built = 2020
            type = "single_family"
            garage = 2.0
            text = "Test description"
            primary_photo = "http://example.com/photo.jpg"
        
        class MockDetail:
            category = "Bedrooms"
            text = ["Bedrooms: 3"]
            parent_category = "Interior"
        
        class MockProperty:
            mls_id = "TEST123"
            mls = "NTTX"
            listing_id = "12345"
            property_id = "67890"
            status = "FOR_SALE"
            address = MockAddress()
            list_price = 500000
            last_sold_price = None
            latitude = 32.7767
            longitude = -96.7970
            prc_sqft = 250
            hoa_fee = 100
            days_on_mls = 30
            description = MockDescription()
            details = [MockDetail()]
            photos = [{"href": "http://example.com/photo1.jpg"}]
            
            def model_dump(self):
                return {
                    "mls_id": self.mls_id,
                    "mls": self.mls,
                    "listing_id": self.listing_id,
                    "property_id": self.property_id,
                    "status": self.status,
                    "address": {
                        "full_line": self.address.full_line,
                        "city": self.address.city,
                        "state": self.address.state,
                        "zip": self.address.zip
                    },
                    "list_price": self.list_price,
                    "last_sold_price": self.last_sold_price,
                    "latitude": self.latitude,
                    "longitude": self.longitude,
                    "prc_sqft": self.prc_sqft,
                    "hoa_fee": self.hoa_fee,
                    "days_on_mls": self.days_on_mls,
                    "description": {
                        "sqft": self.description.sqft,
                        "beds": self.description.beds,
                        "baths_full": self.description.baths_full,
                        "baths_half": self.description.baths_half,
                        "lot_sqft": self.description.lot_sqft,
                        "year_built": self.description.year_built,
                        "type": self.description.type,
                        "garage": self.description.garage,
                        "text": self.description.text,
                        "primary_photo": self.description.primary_photo
                    },
                    "details": [
                        {
                            "category": d.category,
                            "text": d.text,
                            "parent_category": d.parent_category
                        }
                        for d in self.details
                    ],
                    "photos": self.photos
                }
        
        prop = MockProperty()
        result = _normalize_property(prop)
        
        # Verify all expected fields
        assert result["mls_id"] == "TEST123"
        assert result["address"] == "123 Test St"
        assert result["city"] == "Dallas"
        assert result["state"] == "TX"
        assert result["zip_code"] == "75201"
        assert result["latitude"] == 32.7767
        assert result["longitude"] == -96.7970
        assert result["list_price"] == 500000
        assert result["beds"] == 3
        assert result["baths"] == 2.5  # full + half
        assert result["sqft"] == 2000
        assert result["lot_sqft"] == 5000
        assert result["year_built"] == 2020
        assert result["property_type"] == "single_family"
        assert result["image_url"] == "http://example.com/photo1.jpg"
        assert result["source"] == "Realtor.com via HomeHarvest v0.8.18"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])