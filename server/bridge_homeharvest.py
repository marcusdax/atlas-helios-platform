#!/usr/bin/env python3
"""
HomeHarvest Bridge for ATLAS-HELIOS
Scrapes property data from Realtor.com via HomeHarvest library v0.8.18

Usage: python bridge_homeharvest.py <method> <json_args>

Methods:
- search_properties: { "location": "Dallas, TX", "radius": 5, "limit": 20, "listing_type": "for_sale" }
- get_property_details: { "mls_id": "12345678" }
- search_by_coords: { "lat": 32.7767, "lon": -96.7970, "radius": 2 }

Note: Requires: pip install homeharvest==0.8.18
"""

import sys
import json


def _extract_beds_baths_sqft_from_details(details):
    """Extract bedrooms, bathrooms, sqft from Property details list."""
    beds = None
    baths = None
    sqft = None
    lot_sqft = None
    year_built = None
    property_type = None
    roof_type = "Unknown"
    parking = None
    
    if not details:
        return beds, baths, sqft, lot_sqft, year_built, property_type, roof_type, parking
    
    import re
    
    for d in details:
        # Handle both Pydantic model and dict
        if hasattr(d, 'model_dump'):
            d = d.model_dump()
        elif not isinstance(d, dict):
            d = dict(d)
        
        cat = (d.get('category', '') or '').lower()
        text_list = d.get('text') or []
        
        # text can be a list of strings, join them
        if isinstance(text_list, list):
            text = ' '.join(str(t) for t in text_list)
        else:
            text = str(text_list)
        
        # Bedrooms
        if 'bedroom' in cat:
            match = re.search(r'Bedrooms?:\s*(\d+)', text, re.IGNORECASE)
            if match:
                beds = int(match.group(1))
            elif beds is None:
                match = re.search(r'(\d+)', text)
                if match:
                    beds = int(match.group(1))
        
        # Bathrooms
        if 'bathroom' in cat and 'total' in cat:
            match = re.search(r'Total Bathrooms?:\s*(\d+)', text, re.IGNORECASE)
            if match:
                baths = float(match.group(1))
        elif 'bathroom' in cat and 'full' in cat:
            match = re.search(r'Full Bathrooms?:\s*(\d+)', text, re.IGNORECASE)
            if match:
                baths = float(match.group(1))
        
        # Square footage
        if 'sqft' in cat or 'square' in cat:
            match = re.search(r'(\d[\d,]*)', text.replace(',', ''))
            if match:
                val = int(match.group(1))
                if 'lot' in cat:
                    lot_sqft = val
                else:
                    sqft = val
        
        # Year built
        if 'year' in cat and 'built' in cat:
            match = re.search(r'(\d{4})', text)
            if match:
                year_built = int(match.group(1))
        
        # Property type
        if 'type' in cat and property_type is None:
            property_type = text
        
        # Roof type
        if 'roof' in cat:
            roof_type = text
        
        # Parking
        if 'garage' in cat or 'parking' in cat:
            parking = text
    
    return beds, baths, sqft, lot_sqft, year_built, property_type, roof_type, parking


def _normalize_property(prop):
    """Convert a HomeHarvest Property into the ATLAS-HELIOS schema."""
    # Convert to dict if it's a Pydantic model
    if hasattr(prop, 'model_dump'):
        raw = prop.model_dump()
    elif isinstance(prop, dict):
        raw = prop
    else:
        raw = dict(prop)
    
    # Helper to get nested values
    def get_nested(obj, *keys, default=None):
        current = obj
        for k in keys:
            if isinstance(current, dict):
                current = current.get(k)
            elif hasattr(current, k):
                current = getattr(current, k)
            else:
                return default
            if current is None:
                return default
        return current
    
    # Extract from address object
    address_obj = get_nested(raw, 'address')
    full_address = None
    city = None
    state = None
    zip_code = None
    
    if address_obj:
        if isinstance(address_obj, dict):
            full_address = address_obj.get('full_line') or address_obj.get('formatted_address')
            city = address_obj.get('city')
            state = address_obj.get('state')
            zip_code = address_obj.get('zip')
        else:
            full_address = getattr(address_obj, 'full_line', None) or getattr(address_obj, 'formatted_address', None)
            city = getattr(address_obj, 'city', None)
            state = getattr(address_obj, 'state', None)
            zip_code = getattr(address_obj, 'zip', None)
    
    # Extract from description object
    desc_obj = get_nested(raw, 'description')
    desc_sqft = None
    desc_beds = None
    desc_baths_full = None
    desc_baths_half = None
    desc_lot_sqft = None
    desc_year_built = None
    desc_type = None
    desc_garage = None
    desc_text = None
    
    if desc_obj:
        if isinstance(desc_obj, dict):
            desc_sqft = desc_obj.get('sqft')
            desc_beds = desc_obj.get('beds')
            desc_baths_full = desc_obj.get('baths_full')
            desc_baths_half = desc_obj.get('baths_half')
            desc_lot_sqft = desc_obj.get('lot_sqft')
            desc_year_built = desc_obj.get('year_built')
            desc_type = desc_obj.get('type')
            desc_garage = desc_obj.get('garage')
            desc_text = desc_obj.get('text')
        else:
            desc_sqft = getattr(desc_obj, 'sqft', None)
            desc_beds = getattr(desc_obj, 'beds', None)
            desc_baths_full = getattr(desc_obj, 'baths_full', None)
            desc_baths_half = getattr(desc_obj, 'baths_half', None)
            desc_lot_sqft = getattr(desc_obj, 'lot_sqft', None)
            desc_year_built = getattr(desc_obj, 'year_built', None)
            desc_type = getattr(desc_obj, 'type', None)
            desc_garage = getattr(desc_obj, 'garage', None)
            desc_text = getattr(desc_obj, 'text', None)
    
    # Extract from details list
    details = get_nested(raw, 'details')
    det_beds, det_baths, det_sqft, det_lot_sqft, det_year_built, det_type, det_roof, det_parking = _extract_beds_baths_sqft_from_details(details)
    
    # Combine baths
    total_baths = None
    if desc_baths_full is not None:
        total_baths = float(desc_baths_full)
        if desc_baths_half is not None:
            total_baths += 0.5
    elif det_baths is not None:
        total_baths = det_baths
    
    # Get images
    image_url = None
    photos = get_nested(raw, 'photos')
    if photos and isinstance(photos, list) and len(photos) > 0:
        first_photo = photos[0]
        if isinstance(first_photo, dict):
            image_url = first_photo.get('href') or first_photo.get('url')
        else:
            image_url = str(first_photo)
    elif desc_obj and getattr(desc_obj, 'primary_photo', None):
        primary = desc_obj.primary_photo
        if isinstance(primary, dict):
            image_url = primary.get('href') or primary.get('url')
        else:
            image_url = str(primary)
    
    return {
        "mls_id": raw.get('mls_id') or raw.get('mls') or raw.get('listing_id') or raw.get('property_id'),
        "address": full_address,
        "city": city,
        "state": state,
        "zip_code": zip_code,
        "latitude": raw.get('latitude'),
        "longitude": raw.get('longitude'),
        "sale_price": raw.get('last_sold_price'),
        "list_price": raw.get('list_price'),
        "beds": desc_beds or det_beds,
        "baths": total_baths,
        "sqft": desc_sqft or det_sqft,
        "lot_sqft": desc_lot_sqft or det_lot_sqft,
        "year_built": desc_year_built or det_year_built,
        "property_type": desc_type or det_type,
        "roof_type": det_roof or "Unknown",
        "image_url": image_url,
        "listing_date": raw.get('list_date') or raw.get('last_update_date'),
        "status": raw.get('status'),
        "days_on_mls": raw.get('days_on_mls'),
        "hoa_fee": raw.get('hoa_fee'),
        "price_per_sqft": raw.get('prc_sqft'),
        "description": desc_text,
        "parking": det_parking,
        "garage_spaces": desc_garage,
        "source": "Realtor.com via HomeHarvest v0.8.18"
    }


def search_properties(location, radius=5, limit=20, listing_type="for_sale"):
    """Search for properties by location using HomeHarvest v0.8.18 scrape_property."""
    try:
        import homeharvest
    except ImportError:
        return {"error": "homeharvest not installed. pip install homeharvest==0.8.18", "properties": [], "count": 0}

    try:
        results = homeharvest.scrape_property(
            location=location,
            radius=radius,
            limit=limit,
            listing_type=listing_type,
            return_type='pydantic',
        )
    except Exception as e:
        return {"error": f"scrape_property failed: {e}", "properties": [], "count": 0}

    properties = []
    for prop in results or []:
        try:
            properties.append(_normalize_property(prop))
        except Exception as e:
            # Log the error but continue
            continue

    return {"properties": properties, "count": len(properties)}


def get_property_details(mls_id, listing_type="for_sale"):
    """Get detailed property info by MLS ID using HomeHarvest v0.8.18."""
    try:
        import homeharvest
    except ImportError:
        return {"error": "homeharvest not installed. pip install homeharvest==0.8.18"}

    try:
        # Search for the MLS ID across Dallas area (broader search to find it)
        # The MLS ID might be from different MLS providers (NTTX, ZILL, etc.)
        results = homeharvest.scrape_property(
            location="Dallas, TX",
            limit=200,
            listing_type=listing_type,
            return_type='pydantic',
        )
        if results:
            for prop in results:
                # Check both mls_id and listing_id fields
                if (prop.mls_id == mls_id or 
                    getattr(prop, 'listing_id', None) == mls_id or 
                    getattr(prop, 'property_id', None) == mls_id):
                    norm = _normalize_property(prop)
                    # Add extra fields from raw data
                    if hasattr(prop, 'model_dump'):
                        raw = prop.model_dump()
                    elif isinstance(prop, dict):
                        raw = prop
                    else:
                        raw = dict(prop)
                    
                    norm['description'] = raw.get('description')
                    norm['details'] = raw.get('details')
                    norm['photos'] = raw.get('photos')
                    norm['tags'] = raw.get('tags')
                    norm['neighborhoods'] = raw.get('neighborhoods')
                    norm['county'] = raw.get('county')
                    norm['schools'] = raw.get('nearby_schools')
                    norm['tax_history'] = raw.get('tax_history')
                    norm['tax_record'] = raw.get('tax_record')
                    norm['assessed_value'] = raw.get('assessed_value')
                    norm['estimated_value'] = raw.get('estimated_value')
                    norm['current_estimates'] = raw.get('current_estimates')
                    norm['open_houses'] = raw.get('open_houses')
                    norm['pet_policy'] = raw.get('pet_policy')
                    norm['units'] = raw.get('units')
                    norm['monthly_fees'] = raw.get('monthly_fees')
                    norm['one_time_fees'] = raw.get('one_time_fees')
                    norm['terms'] = raw.get('terms')
                    norm['popularity'] = raw.get('popularity')
                    norm['parcel_info'] = raw.get('parcel_info')
                    norm['mls'] = raw.get('mls')
                    norm['listing_id'] = raw.get('listing_id')
                    norm['property_id'] = raw.get('property_id')
                    
                    return {"property": norm}
        return {"error": f"Property with MLS ID {mls_id} not found"}
    except Exception as e:
        return {"error": str(e)}


def search_by_coords(lat, lon, radius=2, listing_type="for_sale", limit=50):
    """Search properties near coordinates using HomeHarvest v0.8.18.
    
    Note: HomeHarvest's radius parameter only works with individual addresses, 
    not bare lat/lon coordinates. This function attempts to find properties 
    by combining lat/lon with a city reference, but for best results consider 
    using a nearby address, zip code, or city name directly via search_properties.
    """
    try:
        import homeharvest
    except ImportError:
        return {"error": "homeharvest not installed. pip install homeharvest==0.8.18", "properties": [], "count": 0}

    try:
        # Try lat,lon format with Dallas as fallback
        location = f"{lat},{lon}, Dallas, TX"
        results = homeharvest.scrape_property(
            location=location,
            radius=radius,
            limit=limit,
            listing_type=listing_type,
            return_type='pydantic',
        )
        
        # If no results, try without radius
        if not results or len(results) == 0:
            results = homeharvest.scrape_property(
                location=location,
                limit=limit,
                listing_type=listing_type,
                return_type='pydantic',
            )
            
        # If still no results, try just Dallas with a wider search
        if not results or len(results) == 0:
            results = homeharvest.scrape_property(
                location="Dallas, TX",
                radius=radius,
                limit=limit,
                listing_type=listing_type,
                return_type='pydantic',
            )
    except Exception as e:
        return {"error": f"scrape_property failed: {e}", "properties": [], "count": 0}

    properties = []
    for prop in results or []:
        try:
            properties.append(_normalize_property(prop))
        except Exception:
            continue

    return {"properties": properties, "count": len(properties)}


def list_methods():
    """List available methods."""
    return {
        "methods": [
            {"name": "search_properties", "description": "Search by location name", "params": ["location", "radius", "limit", "listing_type"]},
            {"name": "get_property_details", "description": "Get details by MLS ID", "params": ["mls_id"]},
            {"name": "search_by_coords", "description": "Search by lat/lon", "params": ["lat", "lon", "radius", "listing_type", "limit"]}
        ]
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python bridge_homeharvest.py <method> [json_args]"}))
        sys.exit(1)

    method = sys.argv[1]
    args = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}

    try:
        if method == "search_properties":
            result = search_properties(
                args.get("location", "Dallas, TX"),
                args.get("radius", 5),
                args.get("limit", 20),
                args.get("listing_type", "for_sale")
            )
        elif method == "get_property_details":
            result = get_property_details(args.get("mls_id"))
        elif method == "search_by_coords":
            result = search_by_coords(
                args.get("lat", 32.7767),
                args.get("lon", -96.7970),
                args.get("radius", 2),
                args.get("listing_type", "for_sale"),
                args.get("limit", 50)
            )
        elif method == "list_methods":
            result = list_methods()
        else:
            result = {"error": f"Unknown method: {method}"}
    except Exception as e:
        result = {"error": str(e)}

    print(json.dumps(result, indent=2, default=str))