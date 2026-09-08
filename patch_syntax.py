import re

with open('src/components/ciclo-builder/ComplianceSimulator.tsx', 'r') as f:
    lines = f.readlines()

# We need to find the correct ending of ComplianceSimulator and remove the garbage
# Let's inspect the exact lines first
