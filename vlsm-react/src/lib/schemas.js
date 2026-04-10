// lib/schemas.js — Zod validation schemas for all forms

import { z } from 'zod';

// Validates an IPv4 address string
const ipv4 = z
  .string()
  .min(1, 'Required')
  .regex(
    /^(\d{1,3}\.){3}\d{1,3}$/,
    'Must be a valid IPv4 address (e.g. 192.168.10.0)'
  )
  .refine(ip => {
    const parts = ip.split('.').map(Number);
    return parts.every(p => p >= 0 && p <= 255);
  }, 'Each octet must be 0–255');

// VLSM Calculator schema
export const vlsmSchema = z.object({
  baseNet: ipv4,
  hosts: z
    .array(
      z.object({
        value: z
          .string()
          .min(1, 'Required')
          .refine(v => {
            const n = parseInt(v, 10);
            return !isNaN(n) && n >= 1 && n <= 16777214;
          }, 'Must be 1–16,777,214'),
      })
    )
    .min(1, 'Add at least one subnet')
    .max(20, 'Maximum 20 subnets'),
});

// FLSM Calculator schema
export const flsmSchema = z.object({
  baseNet: ipv4,
  mask: z
    .string()
    .min(1, 'Required')
    .refine(val => {
      const v = val.trim().replace(/^\//, '');
      if (/^\d+$/.test(v)) {
        const p = parseInt(v, 10);
        return p >= 1 && p <= 30;
      }
      // Subnet mask notation
      if (/^(\d{1,3}\.){3}\d{1,3}$/.test(v)) {
        const parts = v.split('.').map(Number);
        return parts.every(p => p >= 0 && p <= 255);
      }
      return false;
    }, 'Must be a valid prefix (e.g. 24) or subnet mask'),
  count: z
    .string()
    .min(1, 'Required')
    .refine(v => {
      const n = parseInt(v, 10);
      return !isNaN(n) && n >= 2 && n <= 64;
    }, 'Must be 2–64 subnets'),
});

// Sign Up schema
export const signupSchema = z
  .object({
    username: z
      .string()
      .min(3, 'At least 3 characters')
      .max(30, 'Max 30 characters')
      .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores'),
    password: z
      .string()
      .min(6, 'At least 6 characters')
      .max(64, 'Max 64 characters'),
    confirm: z.string().min(1, 'Required'),
  })
  .refine(data => data.password === data.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });

// Login schema
export const loginSchema = z.object({
  username: z.string().min(1, 'Enter your username'),
  password: z.string().min(1, 'Enter your password'),
});

// CLI Config schema
export const cliConfigSchema = z.object({
  topo:     z.enum(['ring', 'bus']),
  protocol: z.enum(['static', 'rip', 'eigrp', 'ospf']),
  eigrpAs:  z.string().refine(v => {
    const n = parseInt(v, 10);
    return !isNaN(n) && n >= 1 && n <= 65535;
  }, 'AS must be 1–65535').optional(),
  ospfPid:  z.string().refine(v => {
    const n = parseInt(v, 10);
    return !isNaN(n) && n >= 1 && n <= 65535;
  }, 'Process ID must be 1–65535').optional(),
});
