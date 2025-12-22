from PIL import Image
from collections import Counter

def get_dominant_color(image_path):
    try:
        img = Image.open(image_path)
        img = img.convert("RGBA")
        width, height = img.size
        
        # Resize for faster processing if needed, but icon should be small
        # img = img.resize((100, 100))
        
        pixels = img.getdata()
        
        # Filter out transparent and white/near-white pixels
        valid_pixels = []
        for r, g, b, a in pixels:
            if a < 128: # Transparent
                continue
            if r > 240 and g > 240 and b > 240: # White
                continue
            valid_pixels.append((r, g, b))
            
        if not valid_pixels:
            return None
            
        counts = Counter(valid_pixels)
        most_common = counts.most_common(5)
        
        return most_common
    except Exception as e:
        print(f"Error: {e}")
        return None

image_path = "frontend/src/assets/icon.png"
colors = get_dominant_color(image_path)

if colors:
    print("Dominant colors (RGB):")
    for color, count in colors:
        hex_color = '#{:02x}{:02x}{:02x}'.format(*color)
        print(f"RGB: {color}, Hex: {hex_color}, Count: {count}")
else:
    print("No valid colors found.")
