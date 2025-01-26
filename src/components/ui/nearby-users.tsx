import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { NearbyUser, subscribeToNearbyUsers, updateUserLocation } from '@/lib/nearby-users';
import { getCurrentPosition } from '@/lib/geo-utils';
import { Users } from 'lucide-react';
import { Card } from './card';
import { ScrollArea } from './scroll-area';
import { useToast } from '@/hooks/use-toast';

export function NearbyUsers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [nearbyUsers, setNearbyUsers] = useState<NearbyUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    let unsubscribe: (() => void) | undefined;

    const updateLocation = async () => {
      try {
        const position = await getCurrentPosition();
        const { latitude, longitude } = position.coords;

        // Update user's location in Firestore
        await updateUserLocation(user.uid, latitude, longitude);

        // Subscribe to nearby users
        unsubscribe = subscribeToNearbyUsers(
          user.uid,
          { latitude, longitude },
          (users) => {
            setNearbyUsers(users);
            setLoading(false);
          }
        );
      } catch (error) {
        console.error('Error getting location:', error);
        toast({
          title: 'Location Error',
          description: 'Unable to access your location. Please check your settings.',
          variant: 'destructive'
        });
        setLoading(false);
      }
    };

    // Update location initially and every 5 minutes
    updateLocation();
    const intervalId = setInterval(updateLocation, 5 * 60 * 1000);

    return () => {
      clearInterval(intervalId);
      if (unsubscribe) unsubscribe();
    };
  }, [user, toast]);

  if (loading) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-center h-20">
          <p className="text-muted-foreground">Loading nearby users...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5" />
        <h3 className="font-semibold">Nearby Users</h3>
        <span className="text-sm text-muted-foreground">
          ({nearbyUsers.length})
        </span>
      </div>

      <ScrollArea className="h-[200px] pr-4">
        {nearbyUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No users nearby
          </p>
        ) : (
          <div className="space-y-3">
            {nearbyUsers.map((nearbyUser) => (
              <div
                key={nearbyUser.id}
                className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
              >
                <span className="text-sm">{nearbyUser.email}</span>
                <span className="text-sm text-muted-foreground">
                  {nearbyUser.distance}km away
                </span>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </Card>
  );
}